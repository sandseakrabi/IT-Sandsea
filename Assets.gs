/**
 * Assets.gs
 * -------------------------------------------------------------
 * ระบบทรัพย์สิน IT (IT Asset Management) — ต่อยอดจากระบบเดิม แยกไฟล์ออกมา
 * ต่างหากจาก Code.gs เพื่อไม่ให้ไฟล์เดิมยาวเกินไป (ฟังก์ชันในไฟล์นี้ถูกเรียกใช้
 * จาก doGet/doPost ใน Code.gs ตามปกติ เพราะทุกไฟล์ .gs ในโปรเจกต์เดียวกัน
 * ใช้ global scope ร่วมกัน ไม่ต้อง import อะไรเพิ่ม)
 *
 * ครอบคลุม 2 เรื่อง:
 * 1. "ทรัพย์สินถาวร" (Assets) เช่น คอมพิวเตอร์ จอภาพ เครื่องพิมพ์ กล้อง CCTV
 *    เราเตอร์ ฯลฯ — ติดตามได้ว่าใครถือครองอยู่ (เบิก/มอบหมาย/รับคืน) พร้อม
 *    ประวัติการเปลี่ยนแปลงทั้งหมด และรองรับ QR Code ต่อชิ้นสำหรับสแกนดู/แก้ไข
 * 2. "วัสดุสิ้นเปลือง" (Supplies) เช่น สายแลน หมึกพิมพ์ อะไหล่ — ติดตาม
 *    จำนวนคงเหลือ พร้อมระบบรับเข้า/เบิกออก และแจ้งเตือนอัตโนมัติเมื่อของใกล้หมด
 *
 * สถานะ "สำรอง" และเมนู "Stock IT" (หน้าเว็บ): "สำรอง" เป็นแค่ค่าหนึ่งในคอลัมน์
 * Status ของแท็บ Assets เหมือน "ใช้งานได้"/"ซ่อมบำรุง" ทุกประการ ไม่ได้มีตาราง
 * หรือฟังก์ชันแยกต่างหาก ใช้กับทรัพย์สินที่มีข้อมูลอยู่แล้วในระบบแต่ยังไม่ได้
 * เบิก/มอบหมายให้ใคร (Assigned_To ว่าง) เมนู "Stock IT" ในหน้าเว็บเป็นเพียง
 * มุมมองกรอง getAssets() เฉพาะ Status = "สำรอง" เท่านั้น พอกด "เบิก/มอบหมาย"
 * (เรียก assignAsset() ด้านล่าง) สถานะจะเปลี่ยนเป็น "ใช้งานได้" ให้อัตโนมัติ
 * ทำให้หลุดออกจากรายการ Stock IT เอง โดยไม่กระทบ Serial/ประวัติเดิมเลย
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. เปิด Apps Script editor ของโปรเจกต์นี้ (ตัวเดียวกับ Code.gs)
 * 2. สร้างไฟล์สคริปต์ใหม่ชื่อ "Assets" แล้ววางโค้ดทั้งหมดในไฟล์นี้ลงไป
 * 3. เลือกฟังก์ชัน setupAssetSheets จาก dropdown ด้านบน แล้วกด "เรียกใช้" (Run)
 *    (สร้างแท็บ Assets, Asset_Log, Supplies, Supply_Log ให้อัตโนมัติ ถ้ามีแท็บ
 *    ชื่อนี้อยู่แล้วจะข้ามไปเฉยๆ ไม่ลบข้อมูลเดิมทิ้ง ปลอดภัยรันซ้ำได้)
 * 4. เพิ่ม action ต่างๆ ในไฟล์นี้เข้าไปใน switch ของ doGet/doPost ที่ Code.gs
 *    (ดูคำแนะนำละเอียดในคอมเมนต์ท้ายไฟล์นี้)
 */

// ===================================================================
// ส่วนที่ 0: ติดตั้งแท็บ Google Sheet ที่จำเป็น
// ===================================================================

function setupAssetSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const assetsSheet = createSheetIfMissing_(ss, 'Assets', [
    'Asset_ID', 'Name', 'Category', 'Brand_Model', 'Serial_Number',
    'Purchase_Date', 'Price', 'Warranty_End', 'Location', 'Status',
    'Assigned_To', 'Notes', 'Created_At', 'Updated_At',
    'CPU', 'RAM', 'Storage', 'Windows_License',
    'Device_Name', 'IP_Address', 'RAM_DDR', 'MAC_Address'
  ]);

  // ทำไมต้องมีบรรทัดนี้: ถ้าแท็บ "Assets" มีอยู่แล้วตั้งแต่ก่อนเพิ่มฟีเจอร์
  // สเปคเครื่อง (CPU/RAM/Storage/Windows_License/Device_Name/IP_Address/RAM_DDR/
  // MAC_Address) createSheetIfMissing_() จะข้ามการสร้างไปเฉย ๆ (กันข้อมูลเดิม
  // หาย) ทำให้คอลัมน์ใหม่พวกนี้ไม่ถูกเติมให้เอง ฟังก์ชันนี้จึงมาเช็คเพิ่ม: ถ้า
  // หัวคอลัมน์ยังไม่มี ก็เติมต่อท้ายให้ ปลอดภัย รันซ้ำกี่ครั้งก็ได้ ไม่ลบ/ไม่
  // สลับข้อมูลเดิม (คอลัมน์ที่มีอยู่แล้วจะถูกข้ามไปเฉยๆ)
  addColumnsIfMissing_(assetsSheet, [
    'CPU', 'RAM', 'Storage', 'Windows_License',
    'Device_Name', 'IP_Address', 'RAM_DDR', 'MAC_Address'
  ]);

  const maintenanceSheet = createSheetIfMissing_(ss, 'Maintenance_Log', [
    'Timestamp', 'Asset_ID', 'Detail', 'Cost', 'Technician', 'Changed_By',
    'Sub_Status', 'Sub_Status_Date'
  ]);

  // เติมคอลัมน์ Sub_Status/Sub_Status_Date ให้แท็บ Maintenance_Log ที่มีอยู่
  // แล้วตั้งแต่ก่อนเพิ่มฟีเจอร์สถานะย่อย (กำลังตรวจสอบ/ส่งเคลม/รับคืน/
  // ทดสอบก่อนส่งคืน) — เหตุผลเดียวกับ CPU/RAM ด้านบน คือกันข้อมูลเดิมหาย
  addColumnsIfMissing_(maintenanceSheet, ['Sub_Status', 'Sub_Status_Date']);

  createSheetIfMissing_(ss, 'Asset_Log', [
    'Timestamp', 'Asset_ID', 'Action', 'Person', 'Detail', 'Changed_By'
  ]);

  createSheetIfMissing_(ss, 'Supplies', [
    'Supply_ID', 'Name', 'Category', 'Unit', 'Qty_On_Hand',
    'Min_Stock', 'Location', 'Notes', 'Updated_At'
  ]);

  createSheetIfMissing_(ss, 'Supply_Log', [
    'Timestamp', 'Supply_ID', 'Type', 'Qty', 'Balance_After', 'Person', 'Note', 'Changed_By'
  ]);

  // เก็บรายการหมวดหมู่ทรัพย์สิน + รหัสย่อ (ดูรายละเอียดที่ getAssetCategories()
  // ด้านล่าง) ถ้าเป็นการติดตั้งครั้งแรก ยังไม่มีข้อมูล จะถูก seed อัตโนมัติ
  // ตอนเรียก getAssetCategories()/generateAssetId_() ครั้งแรก ไม่ต้องทำอะไรตรงนี้เพิ่ม
  createSheetIfMissing_(ss, 'Asset_Categories', ['Category', 'Code', 'Created_At']);

  // แท็บ "ใบเซ็นรับทรัพย์สิน" — เก็บใบเซ็นรับทั้งใบ (1 ใบ อาจมีทรัพย์สินหลายชิ้น)
  // แยกจาก Asset_Log ที่เก็บประวัติต่อชิ้น เพราะจุดประสงค์ต่างกัน: Asset_Log
  // ตอบว่า "ทรัพย์สินชิ้นนี้ผ่านอะไรมาบ้าง" ส่วน Asset_Handover ตอบว่า
  // "ใบเซ็นรับใบนี้ พนักงานคนนี้เซ็นรับอะไรไปบ้างพร้อมกัน วันไหน มีลายเซ็นอะไรเป็นหลักฐาน"
  const handoverSheet = createSheetIfMissing_(ss, 'Asset_Handover', [
    'Receipt_ID', 'Date_Handover', 'Receiver_Name', 'Position', 'Department',
    'Asset_IDs', 'Item_Count', 'Signature_URL', 'Notes', 'Issued_By', 'Created_At',
    'Condition_Photos'
  ]);

  // ทำไมต้องมีบรรทัดนี้: ใบเซ็นรับที่ติดตั้งไว้ก่อนเพิ่มฟีเจอร์ "แนบรูปสภาพ
  // ทรัพย์สิน" จะยังไม่มีคอลัมน์นี้ (createSheetIfMissing_() ข้ามการสร้างไปเฉยๆ
  // เพราะแท็บมีอยู่แล้ว) ฟังก์ชันนี้เติมคอลัมน์ต่อท้ายให้ ปลอดภัย ไม่กระทบ
  // ข้อมูลเดิม เหตุผลเดียวกับ CPU/RAM ของแท็บ Assets ด้านบน
  addColumnsIfMissing_(handoverSheet, ['Condition_Photos']);

  // แท็บ "ใบส่งคืนทรัพย์สิน" — คู่กับ Asset_Handover ด้านบน แต่ใช้ตอน "รับคืน"
  // แทน "แจกออก" ต่างจาก Asset_Handover ตรงที่ต้องเก็บ "สถานะการคืน" แยกเป็น
  // รายชิ้นด้วย (ครบ/ไม่ครบ/เสียหาย) เพราะใบเดียวอาจมีของหลายชิ้นสภาพไม่เหมือนกัน
  // (เช่น Notebook คืนมาสภาพดี แต่ Monitor จอแตก) จึงเก็บไว้ในคอลัมน์
  // Item_Statuses เป็น JSON string [{assetId, status, note}, ...] แทนที่จะแยก
  // เป็นคอลัมน์ตายตัว เพราะจำนวนชิ้นต่อใบไม่คงที่ (ดู saveAssetReturn() ด้านล่าง)
  const returnSheet = createSheetIfMissing_(ss, 'Asset_Return', [
    'Return_ID', 'Date_Return', 'Returner_Name', 'Position', 'Department',
    'Asset_IDs', 'Item_Count', 'Item_Statuses', 'Signature_URL', 'Notes', 'Received_By', 'Created_At',
    'Condition_Photos'
  ]);

  // เหตุผลเดียวกับ Asset_Handover ด้านบน: เติมคอลัมน์ให้ใบส่งคืนที่มีอยู่ก่อนแล้ว
  addColumnsIfMissing_(returnSheet, ['Condition_Photos']);

  Logger.log('ตั้งค่าระบบทรัพย์สิน IT เรียบร้อย (แท็บ Assets, Asset_Log, Maintenance_Log, Supplies, Supply_Log, Asset_Categories, Asset_Handover, Asset_Return)');
}

/**
 * สร้างแท็บใหม่พร้อมหัวคอลัมน์ ถ้ายังไม่มีแท็บชื่อนี้อยู่ก่อนแล้ว
 * ทำไมต้องเช็คก่อนสร้างเสมอ: กันไม่ให้รัน setupAssetSheets() ซ้ำแล้วข้อมูลเดิม
 * หายหรือแท็บซ้ำซ้อน ทำให้รันฟังก์ชันนี้ซ้ำกี่ครั้งก็ปลอดภัย (idempotent)
 */
function createSheetIfMissing_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (sheet) {
    Logger.log('แท็บ "' + name + '" มีอยู่แล้ว ข้ามการสร้าง (ข้อมูลเดิมไม่ถูกแตะต้อง)');
    return sheet;
  }
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeaderRow_(sheet, headers.length); // ฟังก์ชันนี้อยู่ใน Code.gs ใช้ร่วมกันได้เพราะ global scope เดียวกัน
  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * เติมคอลัมน์ใหม่ต่อท้ายชีตที่มีอยู่แล้ว ถ้ายังไม่มีคอลัมน์ชื่อนั้น
 * ทำไมต้องมี: createSheetIfMissing_() ใช้ตอน "สร้างชีตครั้งแรก" เท่านั้น
 * แต่พอฟีเจอร์ใหม่เพิ่มคอลัมน์เข้ามาทีหลัง (เช่น CPU, RAM) ชีตเก่าที่มีอยู่แล้ว
 * ต้องมีวิธีเติมคอลัมน์เข้าไปแบบไม่กระทบข้อมูลเดิม ฟังก์ชันนี้เช็คหัวคอลัมน์
 * ทีละชื่อ ถ้ายังไม่มีก็เติมต่อท้ายคอลัมน์สุดท้าย (ไม่แทรกกลาง เพื่อไม่ให้
 * ตำแหน่งคอลัมน์เดิมขยับ) ปลอดภัยรันซ้ำได้เหมือนกัน
 */
function addColumnsIfMissing_(sheet, columnNames) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  columnNames.forEach(name => {
    if (headers.indexOf(name) === -1) {
      const newColIndex = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColIndex).setValue(name);
      Logger.log('เติมคอลัมน์ "' + name + '" ให้แท็บ "' + sheet.getName() + '" แล้ว (คอลัมน์ที่ ' + newColIndex + ')');
    }
  });
}

/**
 * ออกเลขรหัสรันต่อเนื่อง เช่น "SP0001" ไม่มีวันรีเซ็ต (ต่างจาก generateCaseId
 * ที่รีเซ็ตทุกเดือน) เพราะวัสดุไม่ได้ผูกกับ "เดือน" แบบเคสปัญหา ใช้ LockService
 * เหมือนกันเพื่อกันเลขซ้ำตอนมีคนกดพร้อมกัน (ทรัพย์สินใช้ generateAssetId_()
 * แยกต่างหากด้านล่าง เพราะออกเลขอิงหมวดหมู่ ไม่ใช่รูปแบบ prefix+เลขรันเดียวๆแบบนี้)
 */
/**
 * syncOptions (ไม่ระบุก็ได้ ใช้ตามพฤติกรรมเดิม คืออิงจาก Config อย่างเดียว): { sheetName, idColumn }
 * ถ้าระบุมา จะยึด "เลขล่าสุดที่ยังปรากฏอยู่จริง" ในคอลัมน์ idColumn ของชีต
 * sheetName เป็นหลักเสมอ (ไม่ใช่แค่กันไม่ให้ต่ำกว่า Config เหมือนเดิม แต่ใช้
 * แทน Config ไปเลย) เพราะ Config เป็นแค่ตัวนับที่เดินหน้าอย่างเดียว ต่อให้ลบ
 * แถวทดสอบออกจากชีตไปแล้ว Config ก็ยังจำเลขสูงสุดที่เคยออกไปค้างอยู่ ทำให้เลข
 * ถัดไปกระโดดข้ามไปไกลกว่าที่ควรทั้งที่ในชีตเหลือแค่ไม่กี่ใบ (หรือไม่เหลือเลย)
 *
 * ดังนั้นตอนนี้: เลขถัดไป = เลขสูงสุดที่ยังเห็นอยู่จริงในชีต + 1 เท่านั้น (ถ้าลบ
 * ทุกแถวออกจนชีตว่าง เลขจะเริ่มนับใหม่จาก 1 ให้เอง) ส่วน Config ยังอัพเดทค่า
 * ไว้เหมือนเดิมเพื่อเก็บเป็นข้อมูลอ้างอิง แต่ไม่ถูกใช้เป็นฐานคำนวณอีกต่อไปเมื่อ
 * ระบุ syncOptions มา
 */
function generateSequentialId_(prefix, configKey, padLength, syncOptions) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let base;
    if (syncOptions && syncOptions.sheetName && syncOptions.idColumn) {
      base = getMaxSequentialNumberInSheet_(syncOptions.sheetName, syncOptions.idColumn, prefix);
    } else {
      const config = getConfig();
      base = Number(config[configKey]) || 0;
    }

    const next = base + 1;
    setConfigValue(configKey, next); // เก็บไว้อ้างอิง/debug เท่านั้น ไม่ใช้เป็นฐานคำนวณตอนมี syncOptions
    return prefix + String(next).padStart(padLength, '0');
  } finally {
    lock.releaseLock();
  }
}

/**
 * หาเลขรันสูงสุดที่ยังปรากฏอยู่จริงในคอลัมน์ idColumn ของชีต sheetName สำหรับ
 * รหัสที่ขึ้นต้นด้วย prefix (เช่น "HO-000002" -> 2) ใช้คู่กับ generateSequentialId_()
 * ด้านบนเป็นแหล่งความจริงเดียว (single source of truth) แทน Config
 * ถ้าไม่มีแถวไหนตรง prefix เลย (เช่น ชีตว่าง/ลบทดสอบออกหมดแล้ว) จะคืนค่า 0
 * กลับไป ทำให้เลขถัดไปเริ่มนับใหม่จาก 1 โดยอัตโนมัติ
 */
function getMaxSequentialNumberInSheet_(sheetName, idColumn, prefix) {
  const sheet = getSheet(sheetName);
  const rows = sheetToObjects(sheet);
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$');
  let max = 0;
  rows.forEach(r => {
    const m = String(r[idColumn] || '').match(re);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > max) max = num;
    }
  });
  return max;
}

/**
 * รายชื่อหมวดหมู่ + รหัสย่อเริ่มต้น ใช้ครั้งเดียวตอน seed ข้อมูลลงชีต
 * "Asset_Categories" เมื่อชีตยังว่างอยู่ (ดู ensureCategoriesSeeded_() ด้านล่าง)
 * เก็บค่าตรงกับของเดิมเป๊ะๆ ทุกตัวอักษร รวมถึงตัวสะกดที่ไม่ได้มาตรฐาน (เช่น
 * "Moniter", "Router,Swicth") เพื่อไม่ให้รหัสของทรัพย์สินเก่าที่มีอยู่แล้วเปลี่ยนไป
 * หลังจากนี้ระบบไม่ได้ยึดตาม const ตัวนี้อีกแล้ว แต่อ่าน/เขียนจากชีต
 * Asset_Categories โดยตรง เพิ่มหมวดหมู่ใหม่ได้จากหน้าเว็บ (ปุ่ม "+" ข้างช่อง
 * หมวดหมู่ในฟอร์มเพิ่มทรัพย์สิน) ไม่ต้องแก้โค้ดอีกต่อไป
 *
 * หมวด "อื่นๆ" ไม่มีรหัสย่อ (ไม่รู้จะย่อว่าอะไรให้สื่อความหมาย) จึงปล่อยเป็น
 * ค่าว่าง แล้วให้ generateAssetId_() จัดการออกรหัสเป็น "IT-0001" เฉยๆแทน
 */
const DEFAULT_ASSET_CATEGORIES_ = [
  ['PC', 'PC'],
  ['Notebook', 'NB'],
  ['Moniter', 'MO'],
  ['Mouse', 'MU'],
  ['Keyboard', 'KB'],
  ['ชุดMouse-Keyboard', 'MK'],
  ['Printer', 'PT'],
  ['NVR,CCTV', 'NC'],
  ['Router,Swicth', 'SW'],
  ['AP', 'AP'],
  ['UPS', 'UPS'],
  ['อื่นๆ', '']
];

/**
 * seed ข้อมูลเริ่มต้นลงชีต Asset_Categories ถ้ายังไม่มีแถวข้อมูลเลย (แค่หัวคอลัมน์)
 * ทำไมต้อง seed แบบ lazy ตอนเรียกใช้ครั้งแรก แทนที่จะทำใน setupAssetSheets():
 * เพราะระบบเก่าที่ upgrade มาอาจรัน setupAssetSheets() ไปแล้วก่อนมีฟีเจอร์นี้
 * (สร้างแท็บเปล่าไว้) จุดนี้จึงเป็นตัวกันเหนียวให้ seed ได้ไม่ว่าจะมาจากทางไหน
 * ปลอดภัยรันซ้ำได้ (ถ้ามีข้อมูลอยู่แล้วจะข้ามไปเฉยๆ ไม่ทับของเดิม)
 */
function ensureCategoriesSeeded_(sheet) {
  if (sheet.getLastRow() < 2) {
    const now = new Date();
    const rows = DEFAULT_ASSET_CATEGORIES_.map(([cat, code]) => [cat, code, now]);
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

/**
 * ดึงรายการหมวดหมู่ทรัพย์สินทั้งหมด (ชื่อ + รหัสย่อ) จากชีต Asset_Categories
 * ให้หน้าเว็บใช้สร้าง dropdown หมวดหมู่แบบไดนามิก ไม่ต้อง hardcode ในโค้ดอีก
 *
 * เรียงลำดับให้อ่านง่ายเสมอ ไม่ว่าจะเพิ่มหมวดใหม่กี่ครั้งก็ตาม (เดิมเรียงตาม
 * ลำดับที่เพิ่มเข้าไปในชีต ทำให้หมวดที่เพิ่มทีหลังไปโผล่ท้ายแถวเฉยๆ แม้จะเป็น
 * "อื่นๆ" ที่ควรอยู่ท้ายสุดตลอดก็ตาม):
 * 1. "อื่นๆ" อยู่ท้ายสุดเสมอ ไม่ว่าจะเพิ่มหมวดใหม่เข้ามากี่หมวดก็ตาม
 * 2. หมวดที่เหลือเรียงตามตัวอักษร (ใช้ locale 'th' เทียบ เพราะมีทั้งชื่อไทย/
 *    อังกฤษปนกัน เช่น "ชุดMouse-Keyboard" เทียบกับ "Printer")
 * จุดนี้เป็นจุดเดียวที่คุมลำดับ ทั้ง dropdown ในฟอร์มเพิ่มทรัพย์สินและแถบกรอง
 * หมวดหมู่ในหน้ารายการทรัพย์สินเรียกใช้ฟังก์ชันนี้ตัวเดียวกัน จึงเรียงตรงกันเสมอ
 */
function getAssetCategories() {
  const sheet = getSheet('Asset_Categories');
  ensureCategoriesSeeded_(sheet);
  const rows = sheetToObjects(sheet);
  const categories = rows.map(r => ({ category: String(r.Category), code: r.Code ? String(r.Code) : '' }));

  const OTHERS_LABEL = 'อื่นๆ';
  categories.sort((a, b) => {
    if (a.category === OTHERS_LABEL) return 1;
    if (b.category === OTHERS_LABEL) return -1;
    return a.category.localeCompare(b.category, 'th');
  });

  return categories;
}

/**
 * เพิ่มหมวดหมู่ทรัพย์สินใหม่เอง จากหน้าเว็บ (ปุ่ม "+" ข้างช่องหมวดหมู่) โดยไม่ต้อง
 * แก้โค้ดฝั่งหลังบ้านทุกครั้งที่มีของประเภทใหม่เข้ามา เช่น เพิ่ม "Tablet" รหัส "TL"
 * แล้วครั้งถัดไปเลือกหมวดนี้ได้เลย ระบบจะออกรหัสเป็น "IT-TL-0001" แล้วรันต่อเนื่อง
 * ไปเรื่อยๆเหมือนหมวดอื่น (ใช้ LockService ผ่าน generateSequentialId_() อยู่แล้ว)
 *
 * validate: ชื่อห้ามซ้ำ, รหัสห้ามซ้ำ (ต้องไม่ซ้ำเพราะใช้กำหนด key ตัวนับใน Config
 * ถ้าซ้ำกันจะไปนับรวมกับหมวดอื่นโดยไม่ตั้งใจ), รหัสต้องเป็น A-Z/0-9 เท่านั้น
 * ไม่เกิน 5 ตัว (กันเผลอพิมพ์อักขระพิเศษที่ทำให้รหัสทรัพย์สินอ่านแปลกๆ)
 */
function addAssetCategory(body) {
  const name = String(body.category || '').trim();
  const code = String(body.code || '').trim().toUpperCase();

  if (!name) throw new Error('กรุณาระบุชื่อหมวดหมู่');
  if (!code) throw new Error('กรุณาระบุรหัสย่อ');
  if (!/^[A-Z0-9]{1,5}$/.test(code)) throw new Error('รหัสย่อต้องเป็นตัวอักษร A-Z หรือตัวเลขเท่านั้น ไม่เกิน 5 ตัว');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet('Asset_Categories');
    ensureCategoriesSeeded_(sheet);
    const rows = sheetToObjects(sheet);

    if (rows.some(r => String(r.Category).trim().toLowerCase() === name.toLowerCase())) {
      throw new Error('มีหมวดหมู่ชื่อ "' + name + '" อยู่แล้ว');
    }
    if (rows.some(r => String(r.Code).trim().toUpperCase() === code)) {
      throw new Error('รหัสย่อ "' + code + '" ถูกใช้กับหมวดหมู่อื่นอยู่แล้ว (รหัสต้องไม่ซ้ำกัน)');
    }

    sheet.appendRow([name, code, new Date()]);
  } finally {
    lock.releaseLock();
  }
  return getAssetCategories();
}

/**
 * ออกรหัสทรัพย์สินอิงตามหมวดหมู่ เช่น "IT-PC-0001", "IT-NB-0001" แต่ละหมวดหมู่
 * มีเลขรันของตัวเอง แยกกันเด็ดขาด (ไม่ได้นับรวมกันข้ามหมวด) เก็บเลขรันล่าสุด
 * ของแต่ละหมวดไว้คนละ key ใน Config เช่น Last_Asset_Number_PC, Last_Asset_Number_NB
 * (สร้าง key ใหม่อัตโนมัติตอนใช้ครั้งแรกผ่าน setConfigValue อยู่แล้ว ไม่ต้อง
 * เตรียมอะไรล่วงหน้า) ทำไมต้องแยกเลขรันตามหมวด: หน้างานจริงอยากนับสต๊อกแต่ละ
 * ประเภทแยกกัน (คอมเครื่องที่เท่าไหร่ ไม่ปนกับโน้ตบุ๊คเครื่องที่เท่าไหร่)
 *
 * หมวดหมู่ที่ไม่รู้จัก (เผื่อพิมพ์มาไม่ตรง/ข้อมูลเก่า/ยังไม่ได้เพิ่มในชีต
 * Asset_Categories) ไม่ throw error ทิ้ง แต่ปฏิบัติเหมือน "อื่นๆ" แทน (โค้ด ''
 * ออกเป็น "IT-0001") กันไม่ให้เพิ่มทรัพย์สินไม่ได้เพียงเพราะหมวดหมู่ไม่ตรงกับที่มี
 */
function generateAssetId_(category) {
  const categories = getAssetCategories();
  const match = categories.find(c => c.category === category);
  const code = match ? match.code : '';
  const prefix = code ? ('IT-' + code + '-') : 'IT-';
  const configKey = 'Last_Asset_Number_' + (code || 'OTHER');
  // ส่ง syncOptions เพื่อให้เลขถัดไป = "เลขสูงสุดที่ยังมีอยู่จริงในชีต Assets" + 1
  // (ไม่ใช่เลขที่เคยออกไปแล้วใน Config) — ถ้าลบแถวทรัพย์สินล่าสุดทิ้ง (หรือลบ
  // ในชีตเอง) เลขถัดไปจะถอยกลับมาต่อจากเลขล่าสุดที่เหลืออยู่ ไม่กระโดดข้าม
  // regex ใน getMaxSequentialNumberInSheet_ ผูกกับ prefix เต็ม ('IT-NC-' ไม่ปนกับ
  // 'IT-' ของหมวด "อื่นๆ" เพราะ '^IT-(\\d+)$' ไม่ match 'IT-NC-0090')
  return generateSequentialId_(prefix, configKey, 4, {
    sheetName: 'Assets',
    idColumn: 'Asset_ID'
  });
}

function generateSupplyId_() {
  return generateSequentialId_('SP', 'Last_Supply_Number', 4, {
    sheetName: 'Supplies',
    idColumn: 'Supply_ID'
  });
}

// ===================================================================
// ส่วนที่ 1: ทรัพย์สินถาวร (Assets)
// ===================================================================

function getAssets() {
  const sheet = getSheet('Assets');
  let assets = sheetToObjects(sheet);
  assets = assets.map(a => ({
    ...a,
    Purchase_Date: a.Purchase_Date ? formatDate(a.Purchase_Date) : '',
    Warranty_End: a.Warranty_End ? formatDate(a.Warranty_End) : '',
    Created_At: a.Created_At ? formatDateTime(a.Created_At) : '',
    Updated_At: a.Updated_At ? formatDateTime(a.Updated_At) : ''
  }));
  // เรียงจากรหัสน้อยไปมาก (IT-PC-0001 ก่อน IT-PC-0002 ก่อน ...) ตรงกับที่ใช้งาน
  // จริงหน้างาน อยากไล่ดูของทีละหมวดจากเครื่องแรกไปเรื่อยๆ ไม่ใช่เอาของใหม่สุด
  // ขึ้นก่อน (ถ้าอยากได้ของใหม่สุดก่อน ใช้การค้นหา/กรองแทนได้)
  assets.sort((a, b) => (String(a.Asset_ID) < String(b.Asset_ID) ? -1 : 1));
  return assets;
}

function getAssetHistory(assetId) {
  const sheet = getSheet('Asset_Log');
  let logs = sheetToObjects(sheet);
  logs = logs.filter(l => String(l.Asset_ID) === String(assetId));
  logs = logs.map(l => ({ ...l, Timestamp: formatDateTime(l.Timestamp) }));
  logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  return logs;
}

/**
 * บันทึกประวัติของทรัพย์สินชิ้นหนึ่ง (เพิ่มใหม่ / แก้ไข / เปลี่ยนสถานะ / เบิก-คืน)
 * แยกฟังก์ชันไว้ต่างหากเพราะถูกเรียกจากหลายจุด (saveAsset, updateAsset, assignAsset)
 */
function logAssetHistory_(assetId, action, person, detail, changedBy) {
  const sheet = getSheet('Asset_Log');
  sheet.appendRow([new Date(), assetId, action, person || '', detail || '', changedBy || '']);
}

function saveAsset(body) {
  if (!body.name) throw new Error('กรุณาระบุชื่อทรัพย์สิน');

  const sheet = getSheet('Assets');
  const category = body.category || 'อื่นๆ';
  const assetId = generateAssetId_(category);
  const now = new Date();

  sheet.appendRow([
    assetId,
    body.name,
    category,
    body.brandModel || '',
    body.serialNumber || '',
    body.purchaseDate || '',
    body.price ? Number(body.price) : '',
    body.warrantyEnd || '',
    body.location || '',
    body.status || 'ใช้งานได้',
    '', // Assigned_To ว่างเสมอตอนสร้างใหม่ — ใช้ปุ่ม "เบิก/มอบหมาย" แยกต่างหากทีหลัง
    body.notes || '',
    now,
    now,
    body.cpu || '',
    // RAM และ Storage: หน่วยเป็น GB เสมอ ผู้ใช้กรอกแค่ตัวเลขจากหน้าเว็บ ฝั่งนี้
    // ต่อ "GB" ให้เอง ไม่ต้องพึ่งผู้ใช้พิมพ์หน่วยเอง (กันพิมพ์ผิดเป็น TB/MB ปนกัน)
    body.ram ? (body.ram + ' GB') : '',
    body.storage ? (body.storage + ' GB') : '',
    body.windowsLicense || '',
    body.deviceName || '',
    body.ipAddress || '',
    body.ramDdr || '',
    body.macAddress || ''
  ]);

  // การบันทึกประวัติเป็นของเสริม ไม่ควรทำให้การเพิ่มทรัพย์สินล้มเหลวถ้าพลาด
  try {
    logAssetHistory_(assetId, 'เพิ่มทรัพย์สินใหม่', '', 'หมวดหมู่: ' + category, body.changedBy || '');
  } catch (e) {
    console.error('บันทึกประวัติทรัพย์สินไม่สำเร็จ: ' + e.message);
  }

  return { message: 'เพิ่มทรัพย์สิน ' + assetId + ' เรียบร้อย', assetId: assetId };
}

/**
 * แก้ไขข้อมูลทรัพย์สิน (ชื่อ, หมวดหมู่, ยี่ห้อ/รุ่น, serial, วันที่ซื้อ, ราคา,
 * รับประกัน, สถานที่, สถานะ, หมายเหตุ) — ไม่แตะ Assigned_To ที่นี่ ต้องใช้
 * assignAsset() แยกต่างหาก เพื่อให้ทุกการเบิก/คืนถูกบันทึกประวัติแยกชัดเจน
 * จากการแก้ไขข้อมูลทั่วไป
 */
function updateAsset(body) {
  const sheet = getSheet('Assets');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.Asset_ID]) === String(body.assetId)) {
      const rowNum = i + 1;
      const oldStatus = data[i][col.Status];

      const fieldMap = {
        name: 'Name', category: 'Category', brandModel: 'Brand_Model',
        serialNumber: 'Serial_Number', purchaseDate: 'Purchase_Date',
        price: 'Price', warrantyEnd: 'Warranty_End', location: 'Location',
        status: 'Status', notes: 'Notes',
        cpu: 'CPU', windowsLicense: 'Windows_License',
        deviceName: 'Device_Name', ipAddress: 'IP_Address',
        ramDdr: 'RAM_DDR', macAddress: 'MAC_Address'
      };
      Object.keys(fieldMap).forEach(key => {
        if (body[key] !== undefined) {
          const value = (key === 'price') ? (body[key] === '' ? '' : Number(body[key])) : body[key];
          sheet.getRange(rowNum, col[fieldMap[key]] + 1).setValue(value);
        }
      });
      // RAM และ Storage แยกออกมาต่างหาก เพราะต้องต่อหน่วย " GB" เข้าไปเสมอ
      // (เหมือนตอนสร้างใหม่ใน saveAsset) ถ้าใช้ fieldMap ปกติค่าที่บันทึกจะเป็น
      // ตัวเลขเปล่า ไม่มีหน่วย ทำให้ไม่ตรงกับข้อมูลที่ saveAsset() บันทึกไว้ตอน
      // สร้างครั้งแรก
      if (body.ram !== undefined) {
        sheet.getRange(rowNum, col.RAM + 1).setValue(body.ram === '' ? '' : body.ram + ' GB');
      }
      if (body.storage !== undefined) {
        sheet.getRange(rowNum, col.Storage + 1).setValue(body.storage === '' ? '' : body.storage + ' GB');
      }
      sheet.getRange(rowNum, col.Updated_At + 1).setValue(new Date());

      // ถ้าสถานะเปลี่ยน ให้บันทึกประวัติแยกไว้ต่างหาก (เห็นชัดว่าเปลี่ยนจากอะไรเป็นอะไร)
      if (body.status !== undefined && body.status !== oldStatus) {
        try {
          logAssetHistory_(body.assetId, 'เปลี่ยนสถานะ', '', 'จาก "' + oldStatus + '" เป็น "' + body.status + '"', body.changedBy || '');
        } catch (e) {
          console.error('บันทึกประวัติทรัพย์สินไม่สำเร็จ: ' + e.message);
        }
      }

      return { message: 'อัพเดทข้อมูลทรัพย์สิน ' + body.assetId + ' เรียบร้อย' };
    }
  }
  throw new Error('ไม่พบทรัพย์สินรหัส ' + body.assetId);
}

/**
 * ลบทรัพย์สิน 1 ชิ้นออกจากชีต Assets (ใช้กรณีสร้างผิด/สร้างซ้ำ)
 * body: { assetId }
 *
 * กฎความปลอดภัย (เช็คก่อนลบเสมอ):
 * 1) ถ้ายังมีผู้ถือครองอยู่ (Assigned_To ไม่ว่าง) ห้ามลบ — ให้รับคืนก่อน
 *    กันของหายจากระบบทั้งที่ยังอยู่กับพนักงาน
 * 2) ถ้ารหัสนี้ถูกอ้างอยู่ในใบเซ็นรับ/ใบส่งคืนแล้ว ห้ามลบ เพราะใบเหล่านั้นเป็น
 *    หลักฐานที่มีลายเซ็น ลบทรัพย์สินแล้วหลักฐานจะอ้างถึงของที่ไม่มีอยู่จริง
 *    (ถ้าอยากเลิกใช้จริงๆ ให้เปลี่ยนสถานะเป็น "จำหน่ายแล้ว" แทน)
 *
 * เมื่อลบแล้ว จะลบประวัติของรหัสนั้นใน Asset_Log และ Maintenance_Log ด้วย
 * เพราะเลขรหัสถูกออกใหม่ตามเลขสูงสุดที่ยังเหลือในชีต (ดู generateAssetId_)
 * รหัสที่เพิ่งลบอาจถูกใช้ซ้ำกับทรัพย์สินชิ้นใหม่ ถ้าไม่ลบประวัติเก่า ชิ้นใหม่
 * จะมีประวัติของชิ้นที่ลบไปปนอยู่
 */
function deleteAsset(body) {
  const assetId = String(body.assetId || '').trim();
  if (!assetId) throw new Error('ไม่พบรหัสทรัพย์สิน');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSheet('Assets');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const col = {};
    headers.forEach((h, i) => { col[h] = i; });

    let rowNum = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][col.Asset_ID]) === assetId) {
        rowNum = i + 1;
        if (String(data[i][col.Assigned_To] || '').trim()) {
          throw new Error('ทรัพย์สิน ' + assetId + ' ยังมีผู้ถือครองอยู่ (' + data[i][col.Assigned_To] + ') กรุณารับคืนก่อนลบ');
        }
        break;
      }
    }
    if (rowNum === -1) throw new Error('ไม่พบทรัพย์สินรหัส ' + assetId);

    const refs = [];
    if (isAssetReferencedInReceipts_('Asset_Handover', assetId)) refs.push('ใบเซ็นรับ');
    if (isAssetReferencedInReceipts_('Asset_Return', assetId)) refs.push('ใบส่งคืน');
    if (refs.length) {
      throw new Error('ลบไม่ได้ เพราะ ' + assetId + ' มีอยู่ใน' + refs.join('/') + ' (เป็นเอกสารหลักฐาน) ถ้าเลิกใช้ ให้เปลี่ยนสถานะเป็น "จำหน่ายแล้ว" แทน');
    }

    sheet.deleteRow(rowNum);
    deleteRowsByAssetId_('Asset_Log', assetId);
    deleteRowsByAssetId_('Maintenance_Log', assetId);
  } finally {
    lock.releaseLock();
  }
  return { message: 'ลบทรัพย์สิน ' + assetId + ' เรียบร้อย' };
}

/** เช็คว่ารหัสทรัพย์สินนี้ปรากฏในคอลัมน์ Asset_IDs (คั่นด้วย ", ") ของชีตใบเซ็น/ใบคืนหรือไม่ */
function isAssetReferencedInReceipts_(sheetName, assetId) {
  const sheet = getSheet(sheetName);
  if (sheet.getLastRow() < 2) return false;
  return sheetToObjects(sheet).some(r =>
    String(r.Asset_IDs || '').split(',').map(s => s.trim()).indexOf(assetId) !== -1
  );
}

/** ลบทุกแถวในชีต sheetName ที่คอลัมน์ Asset_ID ตรงกับ assetId (วนจากล่างขึ้นบนกัน index เลื่อน) */
function deleteRowsByAssetId_(sheetName, assetId) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf('Asset_ID') + 1;
  if (!idCol) return;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === assetId) sheet.deleteRow(i + 2);
  }
}

/**
 * เบิก/มอบหมายทรัพย์สินให้พนักงาน หรือรับคืนกลับเข้าคลัง
 * body.assignAction: 'assign' (เบิก/มอบหมาย) หรือ 'return' (รับคืน)
 * body.department: แผนกของผู้รับ (ใช้เฉพาะตอน assign, เก็บลงประวัติเท่านั้น)
 * (ตั้งใจไม่ใช้ชื่อ body.action เพราะชื่อนี้ถูกใช้เป็น action หลักของ endpoint
 *  ทั้งระบบอยู่แล้ว [ดู doPost ใน Code.gs] — ถ้าใช้ชื่อซ้ำกัน ฝั่งเว็บที่ยิง
 *  apiPost('assignAsset', { action: 'assign', ... }) จะเผลอเอา action: 'assign'
 *  ไปทับ action: 'assignAsset' ตอน spread ...body ทำให้ server หา endpoint ไม่เจอ)
 *
 * ความเกี่ยวข้องกับสถานะ "สำรอง" / เมนู "Stock IT": ฟังก์ชันนี้เป็นจุดเดียวที่
 * ทำให้ทรัพย์สินสถานะ "สำรอง" (ของในคลังที่ยังไม่ได้แจกใคร) เปลี่ยนกลับเป็น
 * "ใช้งานได้" โดยอัตโนมัติ ทันทีที่มีการเบิก/มอบหมายออกไป ไม่ต้องมีฟังก์ชัน
 * หรือรายการแยกสำหรับ Stock IT เลย เพราะหน้า Stock IT เป็นแค่มุมมองกรองข้อมูล
 * จาก getAssets() ชุดเดียวกันนี้ (ดู index.html) — ใช้ประวัติ/ปุ่มเดิมทั้งหมด
 */
function assignAsset(body) {
  const sheet = getSheet('Assets');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.Asset_ID]) === String(body.assetId)) {
      const rowNum = i + 1;
      const isReturn = body.assignAction === 'return';
      const previousHolder = data[i][col.Assigned_To]; // เก็บไว้ก่อนเคลียร์ค่า เอาไปใส่ในประวัติตอนรับคืน

      if (isReturn) {
        sheet.getRange(rowNum, col.Assigned_To + 1).setValue('');
        // รับคืนจากผู้ใช้งานเดิม: บังคับเปลี่ยนสถานะเป็น "สำรอง" ทุกครั้งโดย
        // อัตโนมัติ (แทนที่จะปล่อยเป็น "ใช้งานได้" ค้างไว้) เพราะถ้าปล่อยเป็น
        // "ใช้งานได้" ของที่เพิ่งรับคืนจะไปปะปนอยู่กับของที่ยังมีคนถือครองอยู่
        // ในมุมมองเดียวกัน ทำให้ผู้ดูแลคลัง (ซึ่งบางทีจำรหัส/ชื่อทรัพย์สินไม่ได้)
        // หาของที่เพิ่งรับคืนไม่เจอ การบังคับเป็น "สำรอง" ทำให้ของไปโผล่ในเมนู
        // Stock IT ทันที ซึ่งเป็นที่ที่ควรไปหาของว่างอยู่แล้ว
        sheet.getRange(rowNum, col.Status + 1).setValue('สำรอง');
      } else {
        if (!body.person) throw new Error('กรุณาระบุชื่อผู้รับ/ผู้ถือครอง');
        sheet.getRange(rowNum, col.Assigned_To + 1).setValue(body.person);
        // ส่งมอบทรัพย์สินกลับให้พนักงาน = สิ้นสุดสถานะ "ซ่อมบำรุง" หรือ "สำรอง"
        // แล้ว (ดูเงื่อนไขใน addMaintenanceRecord() ด้านบน) จึงเปลี่ยนกลับเป็น
        // "ใช้งานได้" ให้อัตโนมัติ ไม่ต้องรอให้ใครไปแก้สถานะเองอีกที
        //
        // เคส "สำรอง" คือกลไกหลักของเมนู "Stock IT": Stock IT แค่กรองดูทรัพย์สิน
        // ที่ Status = "สำรอง" (ของที่มีอยู่แล้วแต่ยังไม่ได้แจกใคร) เท่านั้น ไม่ได้
        // เป็นระบบแยก พอกดปุ่ม "เบิก/มอบหมาย" เดิมตรงนี้ สถานะจะเปลี่ยนจาก
        // "สำรอง" เป็น "ใช้งานได้" ให้เอง ทำให้ของหลุดออกจากรายการ Stock IT
        // ไปโดยอัตโนมัติ ใช้ Serial/ประวัติเดิมทั้งหมด ไม่ต้องสร้างรายการใหม่
        if (data[i][col.Status] === 'ซ่อมบำรุง' || data[i][col.Status] === 'สำรอง') {
          sheet.getRange(rowNum, col.Status + 1).setValue('ใช้งานได้');
        }
      }
      sheet.getRange(rowNum, col.Updated_At + 1).setValue(new Date());

      // body.refNote: ใช้ตอนเรียกจากฟอร์ม "เซ็นรับทรัพย์สิน" (saveAssetHandover)
      // เพื่อฝากเลขที่ใบเซ็นรับไว้ในประวัติของทรัพย์สินชิ้นนี้ด้วย จะได้ย้อนกลับ
      // ไปเปิดดูใบเซ็น/ลายเซ็นต้นทางได้จากหน้าประวัติทรัพย์สินโดยตรง ไม่ต้อง
      // เดาว่าใบเซ็นไหนเกี่ยวกับเครื่องนี้
      const historyDetail = isReturn
        ? ''
        : [body.department ? 'แผนก: ' + body.department : '', body.refNote || '']
            .filter(Boolean).join(' | ');

      try {
        logAssetHistory_(
          body.assetId,
          isReturn ? 'รับคืน' : 'เบิก/มอบหมาย',
          isReturn ? String(previousHolder || '') : body.person,
          historyDetail,
          body.changedBy || ''
        );
      } catch (e) {
        console.error('บันทึกประวัติทรัพย์สินไม่สำเร็จ: ' + e.message);
      }

      return {
        message: isReturn
          ? 'รับคืนทรัพย์สิน ' + body.assetId + ' เรียบร้อย'
          : 'มอบหมายทรัพย์สิน ' + body.assetId + ' ให้ ' + body.person + ' เรียบร้อย'
      };
    }
  }
  throw new Error('ไม่พบทรัพย์สินรหัส ' + body.assetId);
}

// ===================================================================
// ส่วนที่ 4.5: Asset_Handover — ใบเซ็นรับทรัพย์สิน (มอบหลายชิ้นพร้อมกันได้)
// -------------------------------------------------------------------
// ใช้ตอน IT ถือแท็บเล็ต/มือถือไปส่งมอบอุปกรณ์ต่อหน้าพนักงาน แล้วให้เซ็นชื่อ
// ยืนยันสดๆ ในเครื่อง ไม่ใช่แค่บันทึกว่า "เบิกออกไปแล้ว" เฉยๆ แต่มีลายเซ็น
// เป็นหลักฐานผูกกับใบรับใบนั้นด้วย เผื่อภายหลังมีข้อพิพาทว่าใครรับอะไรไปบ้าง
//
// ทำงานเป็น 2 ชั้น:
// 1) เขียน 1 แถวลง Asset_Handover เก็บภาพรวมทั้งใบ (ผู้รับ/รายการ/ลายเซ็น)
// 2) เรียก assignAsset() เดิมซ้ำทีละชิ้นสำหรับทุก Asset_ID ในใบ เพื่อให้
//    สถานะ/ประวัติ (Asset_Log) ของแต่ละชิ้นถูกอัพเดทด้วยตรรกะเดิมทุกอย่าง
//    (เปลี่ยนเป็น "ใช้งานได้" อัตโนมัติถ้าเดิมเป็น "สำรอง"/"ซ่อมบำรุง" ฯลฯ)
//    ไม่ต้องเขียนโค้ดเปลี่ยนสถานะซ้ำอีกชุด กันโค้ดสองจุดไม่ตรงกันในอนาคต
// ===================================================================

function generateHandoverId_() {
  return generateSequentialId_('HO-', 'Last_Handover_Number', 6, {
    sheetName: 'Asset_Handover',
    idColumn: 'Receipt_ID'
  });
}

// จำนวนรูป "สภาพทรัพย์สิน ณ วันที่รับ/คืน" ที่บังคับต้องแนบขั้นต่อ ใบละกี่รูป
// ทำไมต้องบังคับขั้นต่ำ (ไม่ใช่แค่ "แนบก็ได้ถ้าอยากแนบ"): ถ้าไม่บังคับ คนจะข้าม
// ไปเรื่อยๆเวลารีบ พอมีข้อพิพาทภายหลังว่า "ตอนรับของสภาพเป็นแบบนี้อยู่แล้ว
// ไม่ใช่ผมทำเสีย" จะไม่มีหลักฐานภาพให้เทียบเลย เลข 3 มาจากมุมถ่ายที่ครอบคลุม
// พอสมควรสำหรับอุปกรณ์ทั่วไป (เช่น ด้านหน้า/ด้านหลัง/จุดที่มีตำหนิถ้ามี) ไม่ได้
// ตายตัวว่าต้องเป๊ะ 3 มุมนี้เท่านั้น แค่กันไม่ให้แนบรูปเดียวแล้วมองไม่เห็นสภาพจริง
const MIN_CONDITION_PHOTOS_ = 3;

/**
 * อัพโหลดรูป "สภาพทรัพย์สิน" หลายรูปขึ้น Drive ทีเดียว คืนค่าเป็น array ของ
 * ลิงก์ (เรียงตามลำดับที่ส่งมา) ใช้ uploadPhotoToDrive() ตัวเดิมที่มีอยู่แล้ว
 * (Code.gs) วนทีละรูป เพราะรูปสภาพทรัพย์สินก็เป็นแค่ไฟล์รูปทั่วไปเหมือนรูปแนบ
 * เคสปัญหา ไม่ต่างอะไรกัน ไม่จำเป็นต้องเขียนฟังก์ชันอัพโหลดรูปใหม่ซ้ำอีกชุด
 *
 * @param photosBase64 array ของรูปแบบ base64 (ไม่มี "data:image/...;base64," นำหน้า)
 * @param idPrefix     คำนำหน้าไฟล์ เช่น เลขที่ใบ "HO-000001" กันชื่อไฟล์ชนกัน
 * @return array ของลิงก์รูป (string) เฉพาะรูปที่อัพโหลดสำเร็จเท่านั้น
 */
function uploadConditionPhotos_(photosBase64, idPrefix) {
  const urls = [];
  (photosBase64 || []).forEach((base64, idx) => {
    if (!base64) return;
    const url = uploadPhotoToDrive(base64, 'image/jpeg', idPrefix + '_photo' + (idx + 1) + '.jpg');
    if (url) urls.push(url);
  });
  return urls;
}

/**
 * body: {
 *   receiverName, position, department, dateHandover, notes,
 *   assetIds: [ 'IT-NB-0001', 'IT-MU-0002', ... ],
 *   signatureBase64, signatureMimeType, issuedBy
 * }
 *
 * ทำไมต้องเช็คว่าทุก Asset_ID มีอยู่จริงก่อน แล้วค่อยเริ่มเขียนอะไรเลย (ไม่ใช่
 * เช็คทีละชิ้นระหว่างวน loop): กันเคส "เซ็นไปครึ่งใบ" — ถ้าพิมพ์/ยิงรหัสผิดมา
 * ชิ้นที่ 3 จาก 5 ชิ้น แล้วเพิ่งมาเจอ error ตอนวน loop ถึงชิ้นนั้น จะเกิดสภาพ
 * ค้างคาว่า 2 ชิ้นแรกถูกมอบไปแล้ว (เขียนชีตไปแล้ว) แต่ใบเซ็นยังไม่ถูกบันทึก
 * เพราะ error กลางทาง ตรวจสอบครบก่อนทั้งหมดจึงค่อยลงมือ ปลอดภัยกว่า
 */
function saveAssetHandover(body) {
  const receiverName = String(body.receiverName || '').trim();
  if (!receiverName) throw new Error('กรุณาระบุชื่อผู้รับ');

  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter(Boolean) : [];
  if (!assetIds.length) throw new Error('กรุณาเลือกทรัพย์สินอย่างน้อย 1 ชิ้น');

  if (!body.signatureBase64) throw new Error('กรุณาเซ็นชื่อยืนยันก่อนบันทึก');

  // ทำไมต้องเช็คจำนวนรูปสภาพทรัพย์สินก่อนเริ่มทำอะไรเลย (เหมือนที่เช็คชื่อ/
  // ลายเซ็น/รหัสทรัพย์สินไว้ก่อนหน้านี้ทั้งหมด): กันเคสเดียวกับด้านบน คือถ้าไป
  // เจอ error ตอนอัพโหลดรูปหลังจากเขียนอย่างอื่นไปแล้วบางส่วน จะเกิดสภาพค้างคา
  const conditionPhotos = Array.isArray(body.conditionPhotos) ? body.conditionPhotos.filter(Boolean) : [];
  if (conditionPhotos.length < MIN_CONDITION_PHOTOS_) {
    throw new Error('กรุณาแนบรูปสภาพทรัพย์สินอย่างน้อย ' + MIN_CONDITION_PHOTOS_ + ' รูป (ตอนนี้แนบมา ' + conditionPhotos.length + ' รูป)');
  }

  // เช็คว่าทุกรหัสที่ส่งมามีอยู่จริงในระบบก่อน (ดูเหตุผลด้านบน)
  const allAssets = getAssets();
  const notFound = assetIds.filter(id => !allAssets.some(a => String(a.Asset_ID) === String(id)));
  if (notFound.length) {
    throw new Error('ไม่พบทรัพย์สินรหัส: ' + notFound.join(', '));
  }

  const receiptId = generateHandoverId_();
  const now = new Date();

  // เก็บลายเซ็นเป็นไฟล์รูปใน Drive เหมือนรูปแนบเคสปัญหา (ใช้ uploadPhotoToDrive
  // ตัวเดียวกัน เพราะเป็นแค่รูปภาพ ไม่ต่างอะไรจากรูปถ่ายทั่วไป)
  const signatureUrl = uploadPhotoToDrive(
    body.signatureBase64,
    body.signatureMimeType || 'image/png',
    receiptId + '_signature.png'
  );

  // อัพโหลดรูปสภาพทรัพย์สินทั้งหมด (อย่างน้อย 3 รูป ผ่านการเช็คด้านบนแล้ว) เก็บ
  // เป็นลิงก์คั่นด้วย ", " ในคอลัมน์เดียว (แบบเดียวกับ Asset_IDs ด้านบน) เพราะ
  // จำนวนรูปต่อใบไม่คงที่ (บางใบแนบ 3 รูป บางใบแนบ 5-6 รูป) จึงไม่แยกเป็น
  // คอลัมน์ตายตัวทีละรูป
  const conditionPhotoUrls = uploadConditionPhotos_(conditionPhotos, receiptId);

  const sheet = getSheet('Asset_Handover');
  sheet.appendRow([
    receiptId,
    body.dateHandover || formatDate(now),
    receiverName,
    body.position || '',
    body.department || '',
    assetIds.join(', '),
    assetIds.length,
    signatureUrl,
    body.notes || '',
    body.issuedBy || '',
    now,
    conditionPhotoUrls.join(', ')
  ]);

  // ขั้นตอนที่ 2: มอบหมายทรัพย์สินแต่ละชิ้นจริงๆ ผ่าน assignAsset() เดิม
  // ทำไมครอบ try/catch แยกต่อชิ้น: ถ้าชิ้นใดชิ้นหนึ่งบันทึกไม่สำเร็จ (กรณีหายาก
  // เช่นแถวถูกลบไปพอดีระหว่างนั้น) ใบเซ็นซึ่งบันทึกไปแล้วด้านบนจะไม่หายไปด้วย
  // แค่แจ้งกลับไปว่าชิ้นไหนพลาดบ้าง ให้ IT ไปเช็ค/มอบหมายซ้ำเฉพาะชิ้นนั้นทีหลัง
  const failedItems = [];
  assetIds.forEach(assetId => {
    try {
      assignAsset({
        assetId: assetId,
        assignAction: 'assign',
        person: receiverName,
        department: body.department || '',
        changedBy: body.issuedBy || '',
        refNote: 'เซ็นรับตามใบ ' + receiptId
      });
    } catch (e) {
      console.error('มอบหมายทรัพย์สิน ' + assetId + ' ไม่สำเร็จ (ใบเซ็น ' + receiptId + '): ' + e.message);
      failedItems.push(assetId);
    }
  });

  if (failedItems.length) {
    return {
      receiptId: receiptId,
      message: 'บันทึกใบเซ็นรับ ' + receiptId + ' เรียบร้อย แต่มอบหมายทรัพย์สินไม่สำเร็จ ' +
        failedItems.length + ' ชิ้น (' + failedItems.join(', ') + ') กรุณาเบิก/มอบหมายชิ้นนั้นซ้ำด้วยตนเอง'
    };
  }

  return {
    receiptId: receiptId,
    message: 'บันทึกใบเซ็นรับ ' + receiptId + ' และมอบหมายทรัพย์สิน ' + assetIds.length + ' ชิ้นเรียบร้อย'
  };
}

/** ดึงประวัติใบเซ็นรับทั้งหมด ใหม่สุดขึ้นก่อน (ให้หน้าเว็บโชว์เป็นรายการย้อนหลัง) */
function getAssetHandovers() {
  const sheet = getSheet('Asset_Handover');
  let receipts = sheetToObjects(sheet);
  receipts = receipts.map(r => ({
    ...r,
    Date_Handover: r.Date_Handover ? formatDate(r.Date_Handover) : '',
    Created_At: r.Created_At ? formatDateTime(r.Created_At) : '',
    // แปลงลิงก์รูปที่เก็บเป็น string คั่นด้วย ", " กลับเป็น array ให้หน้าเว็บ
    // ใช้ได้ตรงๆ (แบบเดียวกับ Items ของ getAssetReturns() ด้านล่าง) ใบเก่าก่อน
    // เพิ่มฟีเจอร์นี้จะได้ array ว่างเปล่า ไม่พัง
    Condition_Photos_List: String(r.Condition_Photos || '').split(',').map(s => s.trim()).filter(Boolean)
  }));
  receipts.sort((a, b) => new Date(b.Created_At) - new Date(a.Created_At));
  return receipts;
}

// ===================================================================
// ส่วนที่ 4.6: Asset_Return — ใบส่งคืนทรัพย์สิน (คู่กับ Asset_Handover ด้านบน)
// -------------------------------------------------------------------
// ใช้ตอนพนักงานส่งของคืน IT (ลาออก/เปลี่ยนแผนก/เปลี่ยนเครื่อง ฯลฯ) ทำงานเป็น
// 2 ชั้นเหมือน saveAssetHandover() ทุกประการ:
// 1) เขียน 1 แถวลง Asset_Return เก็บภาพรวมทั้งใบ (ผู้คืน/รายการ/สถานะแต่ละชิ้น/
//    ลายเซ็น) ไว้เป็นหลักฐานว่าใครคืนอะไรไปบ้าง วันไหน สภาพเป็นยังไง
// 2) อัพเดททรัพย์สินแต่ละชิ้นจริงๆ ตาม "สถานะการคืน" ที่เลือกไว้ต่อชิ้น (ไม่ใช่
//    ต่อทั้งใบ เพราะของหลายชิ้นในใบเดียวสภาพไม่เหมือนกันได้ เช่น Notebook คืนมา
//    ครบสภาพดี แต่ Monitor จอแตก) — ดู processReturnItem_() ด้านล่าง
// ===================================================================

/**
 * สถานะการคืนที่เลือกได้ต่อ "รายชิ้น" ของทรัพย์สิน (อิงรหัสทรัพย์สินแต่ละชิ้น
 * ไม่ใช่ทั้งใบ) ตามที่ตกลงกันไว้: ใบส่งคืน 1 ใบอาจมีของหลายชิ้น (เช่น Notebook +
 * Monitor) แต่ละชิ้นเลือกสถานะแยกกันได้ แล้วบันทึกผลลงประวัติของทรัพย์สิน
 * ชิ้นนั้นๆ (Asset_Log) ว่าคืนมาสภาพไหน
 * - "ครบ"     สภาพดี ใช้งานต่อได้ปกติ ครบทุกส่วน
 * - "ไม่ครบ"  ตัวเครื่องคืนมา แต่อุปกรณ์เสริม/ของแถมขาดหาย (เช่น สายชาร์จ, เมาส์)
 * - "เสียหาย" ชำรุด ต้องส่งซ่อมก่อนถึงจะใช้งานต่อได้
 */
const RETURN_STATUS_OPTIONS_ = ['ครบ', 'ไม่ครบ', 'เสียหาย'];

function generateReturnId_() {
  return generateSequentialId_('RT-', 'Last_Return_Number', 6, {
    sheetName: 'Asset_Return',
    idColumn: 'Return_ID'
  });
}

/**
 * body: {
 *   returnerName, position, department, dateReturn, notes,
 *   items: [ { assetId, status, note }, ... ],  // status ต้องอยู่ใน RETURN_STATUS_OPTIONS_
 *   signatureBase64, signatureMimeType, receivedBy
 * }
 *
 * ทำไมต้องเช็คว่าทุก Asset_ID มีอยู่จริง และทุกชิ้นเลือกสถานะมาแล้วถูกต้อง ก่อน
 * เริ่มเขียนอะไรเลย (เหตุผลเดียวกับ saveAssetHandover เป๊ะๆ): กันเคส "คืนไป
 * ครึ่งใบ" ถ้าเจอ error ตอนวน loop ถึงชิ้นกลางๆใบ จะเกิดสภาพค้างคาที่ใบคืนถูก
 * บันทึกไปแล้วแต่ของยังอัพเดทไม่ครบ ตรวจครบก่อนทั้งหมดจึงค่อยลงมือ ปลอดภัยกว่า
 */
function saveAssetReturn(body) {
  const returnerName = String(body.returnerName || '').trim();
  if (!returnerName) throw new Error('กรุณาระบุชื่อผู้คืน');

  const items = Array.isArray(body.items) ? body.items.filter(it => it && it.assetId) : [];
  if (!items.length) throw new Error('กรุณาเลือกทรัพย์สินอย่างน้อย 1 ชิ้น');

  if (!body.signatureBase64) throw new Error('กรุณาเซ็นชื่อยืนยันก่อนบันทึก');

  // เหตุผลเดียวกับ saveAssetHandover(): บังคับแนบรูปสภาพทรัพย์สินตอนคืนขั้นต่ำ
  // MIN_CONDITION_PHOTOS_ รูป เพื่อให้เห็นสภาพจริงตอนรับคืน (สำคัญกว่าตอนแจก
  // ออกด้วยซ้ำ เพราะเป็นหลักฐานว่า "ตอนคืนสภาพเป็นแบบนี้" เทียบกับรูปตอนแจก
  // ออกได้ ถ้ามีข้อพิพาทเรื่องของชำรุด)
  const conditionPhotos = Array.isArray(body.conditionPhotos) ? body.conditionPhotos.filter(Boolean) : [];
  if (conditionPhotos.length < MIN_CONDITION_PHOTOS_) {
    throw new Error('กรุณาแนบรูปสภาพทรัพย์สินอย่างน้อย ' + MIN_CONDITION_PHOTOS_ + ' รูป (ตอนนี้แนบมา ' + conditionPhotos.length + ' รูป)');
  }

  // เช็คทุกชิ้นก่อน: รหัสต้องมีอยู่จริง และต้องเลือกสถานะมาแล้วถูกต้องทุกชิ้น
  const allAssets = getAssets();
  const notFound = [];
  const badStatus = [];
  items.forEach(it => {
    if (!allAssets.some(a => String(a.Asset_ID) === String(it.assetId))) notFound.push(it.assetId);
    if (RETURN_STATUS_OPTIONS_.indexOf(it.status) === -1) badStatus.push(it.assetId);
  });
  if (notFound.length) throw new Error('ไม่พบทรัพย์สินรหัส: ' + notFound.join(', '));
  if (badStatus.length) throw new Error('กรุณาเลือกสถานะการคืนให้ครบทุกชิ้น (รหัส: ' + badStatus.join(', ') + ')');

  const returnId = generateReturnId_();
  const now = new Date();

  // เก็บลายเซ็นเป็นไฟล์รูปใน Drive แบบเดียวกับ saveAssetHandover()
  const signatureUrl = uploadPhotoToDrive(
    body.signatureBase64,
    body.signatureMimeType || 'image/png',
    returnId + '_signature.png'
  );

  // อัพโหลดรูปสภาพทรัพย์สินตอนคืน (เหตุผลเดียวกับ saveAssetHandover() ด้านบน)
  const conditionPhotoUrls = uploadConditionPhotos_(conditionPhotos, returnId);

  const assetIds = items.map(it => it.assetId);
  const sheet = getSheet('Asset_Return');
  sheet.appendRow([
    returnId,
    body.dateReturn || formatDate(now),
    returnerName,
    body.position || '',
    body.department || '',
    assetIds.join(', '),
    assetIds.length,
    JSON.stringify(items.map(it => ({ assetId: it.assetId, status: it.status, note: it.note || '' }))),
    signatureUrl,
    body.notes || '',
    body.receivedBy || '',
    now,
    conditionPhotoUrls.join(', ')
  ]);

  // ขั้นตอนที่ 2: อัพเดททรัพย์สินแต่ละชิ้นจริงๆ ตามสถานะที่เลือกไว้ (ครอบ
  // try/catch แยกต่อชิ้น เหตุผลเดียวกับ saveAssetHandover: ชิ้นใดพลาดไม่ทำให้
  // ใบคืนซึ่งบันทึกไปแล้วด้านบนหายไปด้วย)
  const failedItems = [];
  items.forEach(it => {
    try {
      processReturnItem_(it, returnId, returnerName, body.receivedBy || '');
    } catch (e) {
      console.error('รับคืนทรัพย์สิน ' + it.assetId + ' ไม่สำเร็จ (ใบคืน ' + returnId + '): ' + e.message);
      failedItems.push(it.assetId);
    }
  });

  if (failedItems.length) {
    return {
      returnId: returnId,
      message: 'บันทึกใบส่งคืน ' + returnId + ' เรียบร้อย แต่รับคืนทรัพย์สินไม่สำเร็จ ' +
        failedItems.length + ' ชิ้น (' + failedItems.join(', ') + ') กรุณารับคืนชิ้นนั้นซ้ำด้วยตนเอง'
    };
  }

  return {
    returnId: returnId,
    message: 'บันทึกใบส่งคืน ' + returnId + ' และรับคืนทรัพย์สิน ' + assetIds.length + ' ชิ้นเรียบร้อย'
  };
}

/**
 * อัพเดททรัพย์สิน 1 ชิ้น ตาม "สถานะการคืน" ที่เลือกไว้:
 * - "ครบ" / "ไม่ครบ"  ใช้งานต่อได้ปกติ -> ล้างผู้ถือครองแล้วเข้าคลังทันที
 *   (สถานะ "สำรอง") เหมือนเส้นทางรับคืนเดิมของ assignAsset() ทุกประการ ต่างกัน
 *   แค่ "ไม่ครบ" จะมีบันทึกในประวัติชัดเจนว่าของแถม/อุปกรณ์เสริมส่วนไหนขาดไป
 *   กันลืม/เถียงกันทีหลังว่าตอนคืนของครบไหม
 * - "เสียหาย"  ต้องส่งซ่อมก่อนถึงจะใช้งานต่อได้ ไม่เข้าคลังทันที ใช้กลไกเดิม
 *   ของ addMaintenanceRecord() (บังคับสถานะเป็น "ซ่อมบำรุง" ให้อัตโนมัติ) แทน
 *
 * ทำไมไม่เรียก assignAsset({assignAction:'return'}) ตรงๆ แล้วจบเหมือน
 * saveAssetHandover() เรียก assignAsset() ตอนแจกออก: assignAsset() เดิมออกแบบ
 * มาให้ "รับคืนแล้วเข้าคลังเสมอ" ไม่รู้จักเคส "เสียหาย" ที่ต้องเปลี่ยนเป็น
 * "ซ่อมบำรุง" แทน จึงแยก path นี้ออกมาต่างหาก แต่ยังใช้ logAssetHistory_() ตัว
 * เดิมเพื่อให้ประวัติทรัพย์สินอ่านเป็นไทม์ไลน์เดียวกับเหตุการณ์อื่นๆทั้งหมด
 */
function processReturnItem_(item, returnId, returnerName, receivedBy) {
  const assetId = item.assetId;
  const status = item.status;
  const note = String(item.note || '').trim();

  const sheet = getSheet('Assets');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  let rowNum = -1;
  let previousHolder = '';
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.Asset_ID]) === String(assetId)) {
      rowNum = i + 1;
      previousHolder = data[i][col.Assigned_To];
      break;
    }
  }
  if (rowNum === -1) throw new Error('ไม่พบทรัพย์สินรหัส ' + assetId);

  // ล้างผู้ถือครองก่อนเสมอไม่ว่าสถานะไหน (คืนของแล้วจริงๆ แม้ "เสียหาย" ที่ยัง
  // ไม่เข้าคลังทันทีก็ตาม ไม่ควรค้างชื่อผู้ถือครองเดิมไว้)
  sheet.getRange(rowNum, col.Assigned_To + 1).setValue('');

  if (status === 'เสียหาย') {
    // เข้าเส้นทาง "ซ่อมบำรุง" แทนการเข้าคลัง — addMaintenanceRecord() จะจัดการ
    // สถานะ (บังคับเป็น "ซ่อมบำรุง") และ Updated_At ให้อัตโนมัติ ไม่ต้องตั้งเอง
    addMaintenanceRecord({
      assetId: assetId,
      detail: 'รับคืนแบบเสียหาย จากใบส่งคืน ' + returnId + (note ? (' — ' + note) : ''),
      subStatus: 'กำลังตรวจสอบ',
      subStatusDate: formatDate(new Date()),
      changedBy: receivedBy
    });
  } else {
    // "ครบ" หรือ "ไม่ครบ" -> เข้าคลังทันที (เหมือนเส้นทางเดิมตอนรับคืนผ่าน
    // assignAsset({assignAction:'return'}))
    sheet.getRange(rowNum, col.Status + 1).setValue('สำรอง');
    sheet.getRange(rowNum, col.Updated_At + 1).setValue(new Date());
  }

  const historyDetail = ['สถานะตอนคืน: ' + status, note, 'ใบส่งคืน ' + returnId]
    .filter(Boolean).join(' | ');

  try {
    logAssetHistory_(assetId, 'รับคืน', String(previousHolder || returnerName || ''), historyDetail, receivedBy || '');
  } catch (e) {
    console.error('บันทึกประวัติทรัพย์สินไม่สำเร็จ: ' + e.message);
  }
}

/**
 * ดึงประวัติใบส่งคืนทั้งหมด ใหม่สุดขึ้นก่อน (โครงเดียวกับ getAssetHandovers())
 * แปลง Item_Statuses จาก JSON string กลับเป็น array (คีย์ "Items") ให้หน้าเว็บ
 * ใช้ได้ตรงๆ ไม่ต้อง JSON.parse เองทุกที่ที่เรียกใช้
 */
function getAssetReturns() {
  const sheet = getSheet('Asset_Return');
  let returns = sheetToObjects(sheet);
  returns = returns.map(r => ({
    ...r,
    Date_Return: r.Date_Return ? formatDate(r.Date_Return) : '',
    Created_At: r.Created_At ? formatDateTime(r.Created_At) : '',
    Items: (() => { try { return JSON.parse(r.Item_Statuses || '[]'); } catch (e) { return []; } })(),
    // เหตุผลเดียวกับ Condition_Photos_List ของ getAssetHandovers()
    Condition_Photos_List: String(r.Condition_Photos || '').split(',').map(s => s.trim()).filter(Boolean)
  }));
  returns.sort((a, b) => new Date(b.Created_At) - new Date(a.Created_At));
  return returns;
}

// ===================================================================
// ส่วนที่ 1.5: ประวัติการซ่อมบำรุง (Maintenance Log)
// ทำไมต้องแยกจาก Asset_Log: Asset_Log เก็บ "เหตุการณ์ของระบบ" (สร้างใหม่/
// เปลี่ยนสถานะ/เบิก-คืน) แบบสั้นๆ ส่วน Maintenance_Log เก็บ "รายละเอียดงานซ่อม"
// จริง เช่น เปลี่ยนอะไหล่ชิ้นไหน ใครเป็นช่าง เสียค่าใช้จ่ายเท่าไหร่ — ข้อมูลคนละ
// แบบ คนละจุดประสงค์ ถ้ารวมกันจะทำให้ Asset_Log อ่านยากขึ้นเรื่อยๆ เพราะปนกัน
// ระหว่าง "เหตุการณ์สั้นๆ" กับ "บันทึกงานซ่อมยาวๆ"
// ===================================================================

function getMaintenanceHistory(assetId) {
  const sheet = getSheet('Maintenance_Log');
  let logs = sheetToObjects(sheet);
  logs = logs.filter(l => String(l.Asset_ID) === String(assetId));
  logs = logs.map(l => ({
    ...l,
    Timestamp: formatDateTime(l.Timestamp),
    // เก็บเป็นวันที่ล้วนๆ (ไม่มีเวลา/timezone) เพราะฟอร์มรับแค่ input type="date"
    // ถ้าไม่แปลงตรงนี้ Google Sheets จะเก็บเป็น Date object แล้ว JSON serialize
    // เป็น ISO string เต็มรูปแบบ (เช่น 2026-07-23T17:00:00.000Z) ซึ่งไม่ตรงกับ
    // วันที่ที่ผู้ใช้เลือกจริง (เพี้ยนไปตาม timezone) และรกเกินจำเป็น
    Sub_Status_Date: l.Sub_Status_Date ? formatDate(l.Sub_Status_Date) : ''
  }));
  logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  return logs;
}

/**
 * บันทึกงานซ่อมบำรุง 1 รายการ พร้อมสถานะย่อย (กำลังตรวจสอบ/ส่งเคลม/รับคืน/
 * ทดสอบก่อนส่งคืน) และวันที่ของสถานะย่อยนั้น
 *
 * ไม่ว่าจะเลือกสถานะย่อยไหนก็ตาม ทุกครั้งที่บันทึกงานซ่อมบำรุง สถานะ (Status)
 * ของทรัพย์สินจะถูกบังคับให้เป็น "ซ่อมบำรุง" เสมอ และจะค้างอยู่แบบนั้นไปเรื่อยๆ
 * (ไม่ว่าจะเปลี่ยนสถานะย่อยไปกี่รอบ) จนกว่าจะมีเหตุการณ์ใดเหตุการณ์หนึ่งต่อไปนี้
 * เกิดขึ้น: 1) มีคนแก้ไขสถานะเป็น "ใช้งานได้" เองในฟอร์มแก้ไขทรัพย์สิน หรือ
 * 2) ทรัพย์สินถูก "มอบหมาย" (ส่งมอบ) กลับให้พนักงานผ่าน assignAsset() ซึ่งจะ
 * เปลี่ยนสถานะเป็น "ใช้งานได้" ให้อัตโนมัติ (ดู assignAsset() ด้านล่าง)
 */
function addMaintenanceRecord(body) {
  if (!body.assetId) throw new Error('ไม่พบรหัสทรัพย์สิน');
  if (!body.detail) throw new Error('กรุณาระบุรายละเอียดการซ่อมบำรุง');
  if (!body.subStatus) throw new Error('กรุณาระบุสถานะย่อย');
  if (!body.subStatusDate) throw new Error('กรุณาระบุวันที่');

  const sheet = getSheet('Maintenance_Log');
  sheet.appendRow([
    new Date(),
    body.assetId,
    body.detail,
    body.cost ? Number(body.cost) : '',
    body.technician || '',
    body.changedBy || '',
    body.subStatus,
    body.subStatusDate
  ]);

  // บังคับสถานะทรัพย์สินเป็น "ซ่อมบำรุง" เสมอ ไม่ว่าสถานะย่อยจะเป็นแบบไหน
  const assetsSheet = getSheet('Assets');
  const data = assetsSheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.Asset_ID]) === String(body.assetId)) {
      assetsSheet.getRange(i + 1, col.Status + 1).setValue('ซ่อมบำรุง');
      assetsSheet.getRange(i + 1, col.Updated_At + 1).setValue(new Date());
      break;
    }
  }

  return { message: 'บันทึกประวัติการซ่อมบำรุงเรียบร้อย' };
}

// ===================================================================
// ส่วนที่ 2: วัสดุสิ้นเปลือง (Supplies)
// ===================================================================

function getSupplies() {
  const sheet = getSheet('Supplies');
  let supplies = sheetToObjects(sheet);
  supplies = supplies.map(s => ({ ...s, Updated_At: s.Updated_At ? formatDateTime(s.Updated_At) : '' }));
  supplies.sort((a, b) => String(a.Name || '').localeCompare(String(b.Name || ''), 'th'));
  return supplies;
}

function getSupplyHistory(supplyId) {
  const sheet = getSheet('Supply_Log');
  let logs = sheetToObjects(sheet);
  logs = logs.filter(l => String(l.Supply_ID) === String(supplyId));
  logs = logs.map(l => ({ ...l, Timestamp: formatDateTime(l.Timestamp) }));
  logs.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
  return logs;
}

function logSupplyHistory_(supplyId, type, qty, balanceAfter, person, note, changedBy) {
  const sheet = getSheet('Supply_Log');
  sheet.appendRow([new Date(), supplyId, type, qty, balanceAfter, person || '', note || '', changedBy || '']);
}

function saveSupply(body) {
  if (!body.name) throw new Error('กรุณาระบุชื่อวัสดุ');
  if (!body.unit) throw new Error('กรุณาระบุหน่วยนับ');

  const sheet = getSheet('Supplies');
  const supplyId = generateSupplyId_();
  const now = new Date();
  const qty = Number(body.qty) || 0;

  sheet.appendRow([
    supplyId,
    body.name,
    body.category || '',
    body.unit,
    qty,
    Number(body.minStock) || 0,
    body.location || '',
    body.notes || '',
    now
  ]);

  // ถ้าตอนเพิ่มรายการมีจำนวนเริ่มต้นมากกว่า 0 ให้บันทึกเป็นประวัติ "รับเข้า" ครั้งแรกไว้ด้วย
  if (qty > 0) {
    try {
      logSupplyHistory_(supplyId, 'รับเข้า', qty, qty, '', 'ยอดตั้งต้นตอนเพิ่มรายการ', body.changedBy || '');
    } catch (e) {
      console.error('บันทึกประวัติวัสดุไม่สำเร็จ: ' + e.message);
    }
  }

  return { message: 'เพิ่มวัสดุ ' + supplyId + ' เรียบร้อย', supplyId: supplyId };
}

/**
 * แก้ไขข้อมูลทั่วไปของวัสดุ (ชื่อ, หมวดหมู่, หน่วยนับ, จุดสั่งซื้อขั้นต่ำ, สถานที่,
 * หมายเหตุ) — ไม่แตะ Qty_On_Hand ที่นี่ ต้องใช้ adjustSupplyStock() แยกต่างหาก
 * เพื่อให้ยอดคงเหลือมีประวัติรับเข้า/เบิกออกครบทุกครั้งเสมอ ไม่มีการ "แก้ยอดลอยๆ"
 * ที่ตามหาที่มาไม่ได้ทีหลัง
 */
function updateSupply(body) {
  const sheet = getSheet('Supplies');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.Supply_ID]) === String(body.supplyId)) {
      const rowNum = i + 1;
      const fieldMap = { name: 'Name', category: 'Category', unit: 'Unit', location: 'Location', notes: 'Notes' };
      Object.keys(fieldMap).forEach(key => {
        if (body[key] !== undefined) {
          sheet.getRange(rowNum, col[fieldMap[key]] + 1).setValue(body[key]);
        }
      });
      if (body.minStock !== undefined) {
        sheet.getRange(rowNum, col.Min_Stock + 1).setValue(Number(body.minStock) || 0);
      }
      sheet.getRange(rowNum, col.Updated_At + 1).setValue(new Date());
      return { message: 'อัพเดทข้อมูลวัสดุ ' + body.supplyId + ' เรียบร้อย' };
    }
  }
  throw new Error('ไม่พบวัสดุรหัส ' + body.supplyId);
}

/**
 * ปรับยอดคงเหลือวัสดุ — รับเข้า (type: 'in') หรือเบิกออก (type: 'out')
 * ทุกครั้งที่ปรับยอดจะบันทึกลง Supply_Log เสมอ และถ้าเบิกออกแล้วยอดคงเหลือ
 * ต่ำกว่าจุดสั่งซื้อขั้นต่ำ (Min_Stock) จะส่ง push แจ้งเตือนทีม IT ทันที
 * (เหมือน pattern checkApAlertThreshold_ ใน Code.gs)
 */
function adjustSupplyStock(body) {
  const sheet = getSheet('Supplies');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => { col[h] = i; });

  const qty = Number(body.qty);
  if (isNaN(qty) || qty <= 0) throw new Error('จำนวนต้องเป็นตัวเลขและมากกว่า 0');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col.Supply_ID]) === String(body.supplyId)) {
      const rowNum = i + 1;
      const currentQty = Number(data[i][col.Qty_On_Hand]) || 0;
      const minStock = Number(data[i][col.Min_Stock]) || 0;
      const name = data[i][col.Name];

      let newQty, typeLabel;
      if (body.type === 'in') {
        newQty = currentQty + qty;
        typeLabel = 'รับเข้า';
      } else if (body.type === 'out') {
        // กันไม่ให้เบิกจนยอดติดลบเงียบๆ (เหมือนเหตุผลที่ saveAPLog เช็ค online > total)
        if (qty > currentQty) throw new Error('จำนวนที่เบิก (' + qty + ') มากกว่าจำนวนคงเหลือ (' + currentQty + ') กรุณาตรวจสอบอีกครั้ง');
        newQty = currentQty - qty;
        typeLabel = 'เบิกออก';
      } else {
        throw new Error('ระบุประเภทรายการไม่ถูกต้อง');
      }

      sheet.getRange(rowNum, col.Qty_On_Hand + 1).setValue(newQty);
      sheet.getRange(rowNum, col.Updated_At + 1).setValue(new Date());

      try {
        logSupplyHistory_(body.supplyId, typeLabel, qty, newQty, body.person || '', body.note || '', body.changedBy || '');
      } catch (e) {
        console.error('บันทึกประวัติวัสดุไม่สำเร็จ: ' + e.message);
      }

      // แจ้งเตือนทันทีถ้าเบิกออกแล้วเหลือต่ำกว่าจุดสั่งซื้อขั้นต่ำที่ตั้งไว้
      // (เช็คเฉพาะตอนเบิกออก ไม่เช็คตอนรับเข้า เพราะรับเข้าทำให้ยอดเพิ่มขึ้นอยู่แล้ว)
      try {
        if (minStock > 0 && newQty <= minStock && body.type === 'out') {
          sendPushToAllSubscribers(
            'แจ้งเตือน: วัสดุใกล้หมด - ' + name,
            'คงเหลือ ' + newQty + ' จาก ' + minStock + ' (จุดสั่งซื้อขั้นต่ำ) กรุณาสั่งซื้อเพิ่ม',
            null
          );
        }
      } catch (alertErr) {
        console.error('ส่ง push แจ้งเตือนวัสดุใกล้หมดไม่สำเร็จ: ' + alertErr.message);
      }

      return { message: typeLabel + 'วัสดุ ' + body.supplyId + ' เรียบร้อย (คงเหลือ ' + newQty + ')' };
    }
  }
  throw new Error('ไม่พบวัสดุรหัส ' + body.supplyId);
}

// ===================================================================
// ส่วนที่ 3: Export ทรัพย์สินเป็นไฟล์ Excel (.xlsx) แบบเลือกเงื่อนไขได้
// -------------------------------------------------------------------
// ใช้ pattern เดียวกับ exportMonthlyReportExcel() ใน Code.gs (สร้าง
// Spreadsheet ชั่วคราว -> แปลงเป็น .xlsx จริงผ่าน Drive export URL -> เก็บลง
// โฟลเดอร์ -> ลบไฟล์ชั่วคราวทิ้ง) แยกโฟลเดอร์ Drive ต่างหากจากรายงานรายเดือน
// (Sandsea_Asset_Exports ไม่ใช่ Sandsea_Monthly_Reports) เพราะเป็นคนละประเภท
// เอกสาร ไม่อยากให้ปนกันตอนไล่ดูใน Drive
//
// เงื่อนไขกรอง (ทุกอันเป็น optional เลือกกี่อันพร้อมกันก็ได้ ไม่เลือกเลย =
// export ทั้งหมด): หมวดหมู่, สถานะ, สถานที่/แผนก (ค้นแบบ "มีคำนี้อยู่" ไม่ต้อง
// พิมพ์ตรงเป๊ะ เพราะหน้างานจริงพิมพ์ชื่อแผนกไม่ตรงกันทุกครั้ง เช่น "ครัว" กับ
// "ครัวกลาง"), ผู้ถือครอง (ค้นแบบเดียวกัน), และคำค้นหาทั่วไปอีกช่อง (เผื่อ
// อยากกรองจากอย่างอื่นที่ไม่ใช่ 4 อย่างข้างต้น เช่น Serial หรือหมายเหตุ)
//
// เนื้อหาที่ export จงใจ "ไม่รวม" คอลัมน์สเปคเครื่อง (CPU/RAM/Storage/
// Windows_License/Device_Name/IP/MAC) แม้จะมีทรัพย์สินหมวด PC/Notebook หรือ
// อุปกรณ์เครือข่ายอยู่ในผลลัพธ์ก็ตาม เพราะไฟล์นี้มีไว้ดูภาพรวม "ใคร-อะไร-อยู่
// ไหน-สถานะอะไร-ประวัติเป็นมายังไง" ไม่ใช่รายงานสเปคเครื่อง ถ้าอยากได้สเปค
// ให้เปิดดูทีละชิ้นจากหน้ารายละเอียดทรัพย์สินแทน
// ===================================================================

/**
 * หาโฟลเดอร์ "Sandsea_Asset_Exports" ใน Drive ถ้ายังไม่มีให้สร้างใหม่
 * (pattern เดียวกับ getOrCreateReportFolder_ ใน Code.gs — เก็บ Folder ID ไว้
 * ใน Config คนละ key กัน เพื่อไม่ปนกับโฟลเดอร์รายงานรายเดือน)
 */
function getOrCreateAssetExportFolder_() {
  const config = getConfig();
  if (config.Asset_Export_Folder_Id) {
    try {
      return DriveApp.getFolderById(config.Asset_Export_Folder_Id);
    } catch (e) {
      // ถ้า Folder ID เดิมหาไม่เจอ (ถูกลบไปแล้ว) ให้สร้างใหม่ด้านล่างต่อ
    }
  }
  const folder = DriveApp.createFolder('Sandsea_Asset_Exports');
  setConfigValue('Asset_Export_Folder_Id', folder.getId());
  return folder;
}

/**
 * ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ทิ้ง (กันชื่อแผนก/คำค้นที่ผู้ใช้พิมพ์มามีอักขระ
 * แปลกๆ ปนอยู่ เช่น / \ : ทำให้ตั้งชื่อไฟล์ใน Drive พังหรือดูรก) แทนที่ด้วย "_"
 */
function sanitizeForFileName_(text) {
  return String(text || '').trim().replace(/[\/\\:*?"<>|]+/g, '_').replace(/\s+/g, '_');
}

/**
 * Export รายการทรัพย์สิน (กรองตามเงื่อนไขที่เลือก) เป็นไฟล์ Excel (.xlsx)
 * มี 2 แท็บ: "รายการทรัพย์สิน" (ข้อมูลหลักของแต่ละชิ้น) และ "ประวัติ" (รวม
 * เหตุการณ์จาก Asset_Log + งานซ่อมบำรุงจาก Maintenance_Log เฉพาะของทรัพย์สิน
 * ที่อยู่ในผลลัพธ์การกรองเท่านั้น เรียงตามรหัสทรัพย์สินแล้วตามเวลา)
 *
 * @param filters object จาก query parameter (e.parameter ตอนเรียกจาก doGet):
 *   - category:    ชื่อหมวดหมู่ตรงตัว หรือ 'all'/ว่าง = ทุกหมวดหมู่
 *   - status:      ชื่อสถานะตรงตัว หรือ 'all'/ว่าง = ทุกสถานะ
 *   - location:    ค้นหาบางส่วนในช่อง "สถานที่/แผนก" (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
 *   - assignedTo:  ค้นหาบางส่วนในช่อง "ผู้ถือครอง" (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
 *   - keyword:     ค้นหาบางส่วนใน ชื่อ/Serial/สถานที่/ผู้ถือครอง/หมายเหตุ รวมกัน
 */
function exportAssetsExcel(filters) {
  filters = filters || {};
  const category = String(filters.category || 'all').trim();
  const status = String(filters.status || 'all').trim();
  const location = String(filters.location || '').trim().toLowerCase();
  const assignedTo = String(filters.assignedTo || '').trim().toLowerCase();
  const keyword = String(filters.keyword || '').trim().toLowerCase();

  let assets = getAssets();

  if (category && category !== 'all') {
    assets = assets.filter(a => String(a.Category) === category);
  }
  if (status && status !== 'all') {
    assets = assets.filter(a => String(a.Status) === status);
  }
  if (location) {
    assets = assets.filter(a => String(a.Location || '').toLowerCase().indexOf(location) !== -1);
  }
  if (assignedTo) {
    assets = assets.filter(a => String(a.Assigned_To || '').toLowerCase().indexOf(assignedTo) !== -1);
  }
  if (keyword) {
    assets = assets.filter(a =>
      String(a.Name || '').toLowerCase().indexOf(keyword) !== -1 ||
      String(a.Serial_Number || '').toLowerCase().indexOf(keyword) !== -1 ||
      String(a.Location || '').toLowerCase().indexOf(keyword) !== -1 ||
      String(a.Assigned_To || '').toLowerCase().indexOf(keyword) !== -1 ||
      String(a.Notes || '').toLowerCase().indexOf(keyword) !== -1
    );
  }

  if (!assets.length) throw new Error('ไม่พบทรัพย์สินตามเงื่อนไขที่เลือก');

  // สร้างชื่อไฟล์ให้บอกเงื่อนไขที่ใช้กรองไว้คร่าวๆ (ดูจากชื่อไฟล์ใน Drive ได้เลย
  // ว่า export ครั้งนี้กรองอะไรไว้บ้าง โดยไม่ต้องเปิดไฟล์ดู) ถ้าไม่ได้กรองอะไร
  // เลยจะได้แค่ "ทั้งหมด" เฉยๆ
  const labelParts = [];
  if (category && category !== 'all') labelParts.push(category);
  if (status && status !== 'all') labelParts.push(status);
  if (location) labelParts.push('สถานที่-' + location);
  if (assignedTo) labelParts.push('ผู้ถือครอง-' + assignedTo);
  if (keyword) labelParts.push('คำค้น-' + keyword);
  const filterLabel = labelParts.length ? labelParts.join('_') : 'ทั้งหมด';

  const now = new Date();
  const timestampStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const fileName = sanitizeForFileName_('Sandsea_Assets_' + timestampStr + '_' + filterLabel);

  // สร้าง Spreadsheet ชั่วคราวใน Drive (ทำหน้าที่เป็น "ไฟล์ทำงาน" ก่อนแปลงเป็น .xlsx)
  const ss = SpreadsheetApp.create(fileName);

  // ----- แท็บ 1: รายการทรัพย์สิน -----
  // จงใจไม่ใส่คอลัมน์สเปคเครื่อง (CPU/RAM/Storage/Windows/Device Name/IP/MAC)
  // ตามที่ระบุไว้ด้านบนหัวไฟล์นี้
  const listSheet = ss.getSheets()[0];
  listSheet.setName('รายการทรัพย์สิน');
  writeRowsToSheet_(listSheet, assets, [
    { header: 'รหัส', field: 'Asset_ID' },
    { header: 'ชื่อ', field: 'Name' },
    { header: 'หมวดหมู่', field: 'Category' },
    { header: 'ยี่ห้อ/รุ่น', field: 'Brand_Model' },
    { header: 'Serial Number', field: 'Serial_Number' },
    { header: 'สถานที่/แผนก', field: 'Location' },
    { header: 'สถานะ', field: 'Status' },
    { header: 'ผู้ถือครอง', field: 'Assigned_To' },
    { header: 'วันที่ซื้อ', field: 'Purchase_Date' },
    { header: 'รับประกันถึง', field: 'Warranty_End' },
    { header: 'หมายเหตุ', field: 'Notes' }
  ]);

  // ----- แท็บ 2: ประวัติ -----
  // รวม Asset_Log (เหตุการณ์ระบบ: เพิ่มใหม่/เปลี่ยนสถานะ/เบิก-คืน) กับ
  // Maintenance_Log (รายละเอียดงานซ่อมบำรุง) เข้าด้วยกันในตารางเดียว เรียง
  // ตามรหัสทรัพย์สินก่อน แล้วค่อยเรียงตามเวลาในแต่ละชิ้น อ่านเป็นไทม์ไลน์ต่อ
  // ทรัพย์สินได้ง่าย ไม่ต้องสลับดู 2 แท็บ
  const assetIdSet = {};
  assets.forEach(a => { assetIdSet[String(a.Asset_ID)] = true; });

  const assetLogRows = sheetToObjects(getSheet('Asset_Log'))
    .filter(l => assetIdSet[String(l.Asset_ID)])
    .map(l => ({
      Asset_ID: l.Asset_ID,
      Timestamp: formatDateTime(l.Timestamp),
      TimestampSort: toDateObject(l.Timestamp),
      Type: 'เหตุการณ์',
      Event: l.Action,
      Detail: [l.Person ? ('บุคคล: ' + l.Person) : '', l.Detail || ''].filter(Boolean).join(' | '),
      Changed_By: l.Changed_By
    }));

  const maintenanceRows = sheetToObjects(getSheet('Maintenance_Log'))
    .filter(l => assetIdSet[String(l.Asset_ID)])
    .map(l => ({
      Asset_ID: l.Asset_ID,
      Timestamp: formatDateTime(l.Timestamp),
      TimestampSort: toDateObject(l.Timestamp),
      Type: 'ซ่อมบำรุง',
      Event: l.Sub_Status || 'ซ่อมบำรุง',
      Detail: [l.Detail || '', l.Technician ? ('ช่าง: ' + l.Technician) : '', l.Cost ? ('ค่าใช้จ่าย: ' + l.Cost) : ''].filter(Boolean).join(' | '),
      Changed_By: l.Changed_By
    }));

  const historyRows = assetLogRows.concat(maintenanceRows).sort((a, b) => {
    if (String(a.Asset_ID) !== String(b.Asset_ID)) {
      return String(a.Asset_ID) < String(b.Asset_ID) ? -1 : 1;
    }
    return (a.TimestampSort || 0) - (b.TimestampSort || 0);
  });

  const historySheet = ss.insertSheet('ประวัติ');
  writeRowsToSheet_(historySheet, historyRows, [
    { header: 'รหัสทรัพย์สิน', field: 'Asset_ID' },
    { header: 'วันที่/เวลา', field: 'Timestamp' },
    { header: 'ประเภท', field: 'Type' },
    { header: 'เหตุการณ์', field: 'Event' },
    { header: 'รายละเอียด', field: 'Detail' },
    { header: 'ผู้บันทึก', field: 'Changed_By' }
  ]);

  SpreadsheetApp.flush();

  // ----- แปลง Google Sheet เป็นไฟล์ .xlsx จริง แล้วลบไฟล์ Google Sheet ต้นฉบับทิ้ง -----
  // (เหตุผลเดียวกับ exportMonthlyReportExcel ใน Code.gs)
  const ssFile = DriveApp.getFileById(ss.getId());
  const exportUrl = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  const token = ScriptApp.getOAuthToken();
  const xlsxResponse = UrlFetchApp.fetch(exportUrl, {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });

  if (xlsxResponse.getResponseCode() !== 200) {
    throw new Error('แปลงไฟล์เป็น Excel ไม่สำเร็จ (status ' + xlsxResponse.getResponseCode() + ')');
  }

  const xlsxBlob = xlsxResponse.getBlob().setName(fileName + '.xlsx');
  const folder = getOrCreateAssetExportFolder_();
  const xlsxFile = folder.createFile(xlsxBlob);
  xlsxFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  ssFile.setTrashed(true);

  return {
    message: 'Export ทรัพย์สิน ' + assets.length + ' รายการ เรียบร้อย',
    fileName: fileName + '.xlsx',
    url: xlsxFile.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + xlsxFile.getId()
  };
}

// ===================================================================
// วิธีเชื่อมกับ Code.gs (ทำครั้งเดียวตอนติดตั้ง):
// เปิด Code.gs แล้วเพิ่ม case ต่อไปนี้ในฟังก์ชันที่เกี่ยวข้อง —
// ถ้าใช้ตัวช่วยจากในนี้ (Claude) แก้ให้แล้ว ไม่ต้องทำเองซ้ำ ส่วนนี้ไว้อ้างอิงเผื่อ
// ต้องย้อนดูทีหลังว่ามันต่อกันตรงไหน:
//
// ใน doGet(e) เพิ่มใน switch(action):
//   case 'getAssets':              return jsonResponse(getAssets());
//   case 'getAssetHistory':        return jsonResponse(getAssetHistory(e.parameter.assetId));
//   case 'getMaintenanceHistory':  return jsonResponse(getMaintenanceHistory(e.parameter.assetId));
//   case 'getSupplies':            return jsonResponse(getSupplies());
//   case 'getSupplyHistory':       return jsonResponse(getSupplyHistory(e.parameter.supplyId));
//   case 'exportAssets':           return jsonResponse(exportAssetsExcel(e.parameter));
//   case 'getAssetHandovers':      return jsonResponse(getAssetHandovers());
//   case 'getAssetReturns':        return jsonResponse(getAssetReturns());
//
// ใน doPost(e) เพิ่มใน switch(action):
//   case 'saveAsset':            return jsonResponse(saveAsset(body));
//   case 'updateAsset':          return jsonResponse(updateAsset(body));
//   case 'deleteAsset':          return jsonResponse(deleteAsset(body));
//   case 'assignAsset':          return jsonResponse(assignAsset(body));
//   case 'addMaintenanceRecord': return jsonResponse(addMaintenanceRecord(body));
//   case 'saveSupply':           return jsonResponse(saveSupply(body));
//   case 'updateSupply':         return jsonResponse(updateSupply(body));
//   case 'adjustSupplyStock':    return jsonResponse(adjustSupplyStock(body));
//   case 'saveAssetHandover':    return jsonResponse(saveAssetHandover(body));
//   case 'saveAssetReturn':      return jsonResponse(saveAssetReturn(body));
// ===================================================================
