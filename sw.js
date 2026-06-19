/**
 * sw.js
 * -------------------------------------------------------------
 * Service Worker สำหรับ Sandsea IT System
 * ทำหน้าที่ 2 อย่างหลัก:
 * 1. ทำให้แอปติดตั้งเป็น PWA ได้ (เงื่อนไขหนึ่งของ "installable app" คือต้องมี
 *    service worker ที่ลงทะเบียนสำเร็จ ไม่งั้นเบราว์เซอร์จะไม่โชว์ปุ่ม "ติดตั้ง")
 * 2. แคชไฟล์เปลือกแอป (HTML/CSS/JS/ไอคอน) ไว้ ทำให้เปิดแอปได้แม้เน็ตหลุด
 *    หรือเน็ตช้า (โหลดจากแคชก่อน เร็วกว่ารอโหลดจากเซิร์ฟเวอร์)
 *
 * สำคัญ: ข้อมูลจริง (เคส, AP log, CCTV log ฯลฯ) ที่ดึงจาก Google Apps Script
 * จะไม่ถูกแคชโดย Service Worker นี้ เพราะเป็นข้อมูลที่เปลี่ยนตลอดเวลา
 * ถ้าแคชไว้จะทำให้เห็นข้อมูลเก่าค้าง ระบบนี้จึงปล่อยให้ request ไปยัง
 * Apps Script (domain script.google.com) วิ่งตรงไปอินเทอร์เน็ตเสมอ ไม่ผ่านแคช
 */

const CACHE_NAME = 'sandsea-it-shell-v1';

// ไฟล์เปลือกแอป (app shell) ที่จะแคชไว้ตั้งแต่ตอนติดตั้ง
// ทำไมต้องใช้ path สัมพัทธ์ (relative path): เพราะ Apps Script Web App
// อาจถูก deploy อยู่ใต้ path ที่ไม่แน่นอน การใช้ path เต็มจาก root ("/...")
// อาจชี้ผิดที่ได้ ใช้ relative path ปลอดภัยกว่า
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './config.js'
];

/**
 * ตอนติดตั้ง (install): โหลดไฟล์เปลือกแอปทั้งหมดเข้าแคชทันที
 * ทำไมต้องใช้ skipWaiting(): เพื่อให้เวอร์ชันใหม่ของ service worker
 * เริ่มทำงานทันทีโดยไม่ต้องรอให้ผู้ใช้ปิดแท็บเดิมทั้งหมดก่อน
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/**
 * ตอนเริ่มทำงาน (activate): ลบแคชเวอร์ชันเก่าทิ้ง (ถ้ามี) แล้วเข้าควบคุมหน้าเว็บทันที
 * ทำไมต้องลบแคชเก่า: ป้องกันไม่ให้พื้นที่เก็บข้อมูลในเครื่องผู้ใช้บวมขึ้นเรื่อยๆ
 * ทุกครั้งที่อัพเดทแอป และป้องกันไม่ให้เผลอเสิร์ฟไฟล์เวอร์ชันเก่าปนกับใหม่
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * ดักจับทุก request ที่หน้าเว็บยิงออกไป (fetch event)
 * กลยุทธ์ที่ใช้:
 * - คำขอไปยัง Google Apps Script (API ข้อมูลจริง) -> ปล่อยผ่านไปเน็ตตรงๆเสมอ
 *   (Network only) ไม่แตะแคชเลย เพื่อให้ได้ข้อมูลล่าสุดทุกครั้ง
 * - คำขอไฟล์เปลือกแอป (HTML/CSS/JS/ไอคอน) -> ลองหาในแคชก่อน (Cache first)
 *   ถ้าไม่มีในแคชค่อยไปโหลดจากเน็ต แล้วเก็บใส่แคชไว้ใช้ครั้งถัดไป
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ปล่อยผ่านคำขอที่ไม่ใช่ GET (เช่น POST ไป Apps Script ตอนส่งฟอร์ม) ตรงๆเสมอ
  if (event.request.method !== 'GET') return;

  // คำขอไป Google Apps Script ให้วิ่งตรงไปเน็ตเสมอ ไม่แคช (ข้อมูลต้องสดใหม่)
  const isAppsScriptRequest = url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com');
  if (isAppsScriptRequest) {
    event.respondWith(fetch(event.request));
    return;
  }

  // เฉพาะคำขอที่มาจากโดเมนเดียวกับแอปเท่านั้นที่จะแคช (กันแคชไฟล์จากเว็บอื่นโดยไม่ตั้งใจ)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        // เก็บสำเนาไฟล์ที่เพิ่งโหลดสำเร็จใส่แคชไว้ใช้ครั้งถัดไป
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => {
        // ถ้าออฟไลน์และไม่มีในแคช (เช่นเปิดหน้าใหม่ที่ไม่เคยเข้าก่อน) ส่งหน้าหลักกลับไปแทน
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
