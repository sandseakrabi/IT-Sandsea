/**
 * config.js
 * -------------------------------------------------------------
 * ไฟล์นี้เก็บ "URL ของ Apps Script" ที่ index.html ใช้เชื่อมต่อกับ Google Sheet
 *
 * ทำไมต้องแยกไฟล์นี้ออกมา: เวลาพี่ deploy Apps Script ใหม่ (เช่น แก้โค้ดแล้ว
 * deploy เวอร์ชันใหม่) Google จะให้ URL ใหม่มา พี่แค่มาแก้ค่าที่ไฟล์นี้ไฟล์เดียว
 *
 * วิธีตั้งค่า:
 * 1. หลัง Deploy Apps Script เป็น Web App แล้ว จะได้ URL หน้าตาประมาณ
 *    https://script.google.com/macros/s/AKfycb.../exec
 * 2. เอา URL นั้นมาวางแทนค่าด้านล่างนี้ (อยู่ในเครื่องหมายคำพูดเดิม)
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmitjqZbgobvwgDqG31tZJAaZn3Hswa4BDFyfcbbe-oKqzal9wO6QqHEObbPU2Fm_-/exec';
