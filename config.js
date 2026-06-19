/**
 * config.js
 * -------------------------------------------------------------
 * ไฟล์นี้เก็บ "URL ของ Apps Script" ที่ทั้งหน้าพนักงานและหน้า IT ใช้ร่วมกัน
 *
 * ทำไมต้องแยกไฟล์นี้ออกมา: เวลาพี่ deploy Apps Script ใหม่ (เช่น แก้โค้ดแล้ว
 * deploy เวอร์ชันใหม่) Google จะให้ URL ใหม่มา พี่แค่มาแก้ค่าที่ไฟล์นี้ไฟล์เดียว
 * ทั้งหน้าพนักงานและหน้า IT จะใช้ URL ใหม่ทันที ไม่ต้องไปไล่แก้หลายไฟล์
 *
 * วิธีตั้งค่า:
 * 1. หลัง Deploy Apps Script เป็น Web App แล้ว จะได้ URL หน้าตาประมาณ
 *    https://script.google.com/macros/s/AKfycb.../exec
 * 2. เอา URL นั้นมาวางแทนค่าด้านล่างนี้ (อยู่ในเครื่องหมายคำพูดเดิม)
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwcd0_SCVQnCPESngdbIvrAaZ3u4rFzmGfujxfm0t-RrP_Tj4vcJAWM51JG9B-LTfP7/exec';
