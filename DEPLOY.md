# วิธีทำให้ลูกค้าภายนอกสแกน QR แล้วเข้าได้จริง

ระบบนี้มีเซิร์ฟเวอร์กลางแล้ว ข้อมูลสินค้าและ SN จะเก็บใน `sn-data.json` เมื่อรันผ่าน Node.js hosting

## ทดสอบในเครื่อง

1. เปิด Terminal ในโฟลเดอร์นี้
2. รัน `npm start`
3. เปิดหน้าพนักงาน `http://localhost:3000`
4. หน้าลูกค้าจาก QR จะเป็น `http://localhost:3000/?sn=เลขSN`

## เอาขึ้นให้คนภายนอกใช้

นำไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น Node.js hosting เช่น Render, Railway, VPS หรือโฮสติ้งบริษัท

คำสั่งเริ่มระบบ:

```text
npm start
```

ตั้งรหัสแอดมินจริงด้วย environment variable:

```text
ADMIN_PASSWORD=รหัสที่ต้องการ
```

เมื่อได้โดเมนจริง เช่น

```text
https://warranty.yourcompany.com
```

หน้าพนักงานจะอยู่ที่ชื่อเว็บหลัก:

```text
https://warranty.yourcompany.com
```

ให้เปิดระบบผ่านโดเมนนั้น แล้ว QR Code ในหน้า “พิมพ์ Barcode” จะพาลูกค้าไปที่:

```text
https://warranty.yourcompany.com/?sn=เลขSN
```

ลูกค้าที่สแกน QR จะเห็นหน้าตรวจสอบประกันของ SN นั้นทันที
ถ้าลูกค้าพิมพ์ชื่อเว็บหลักเองโดยไม่มีเลข SN จะเจอหน้าล็อกอินพนักงาน
