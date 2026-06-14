# วิธีทำให้ลูกค้าภายนอกสแกน QR แล้วเข้าได้จริง

ระบบนี้มีเซิร์ฟเวอร์กลางแล้ว ข้อมูลสินค้าและ SN จะเก็บใน `sn-data.json` เมื่อรันผ่าน Node.js hosting

## ทดสอบในเครื่อง

1. เปิด Terminal ในโฟลเดอร์นี้
2. รัน `npm start`
3. เปิดหน้าพนักงาน `http://localhost:3000/admin`
4. หน้าลูกค้าอยู่ที่ `http://localhost:3000`

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

หน้าพนักงานจะอยู่ที่:

```text
https://warranty.yourcompany.com/admin
```

ให้เปิดระบบผ่านโดเมนนั้น แล้ว QR Code ในหน้า “พิมพ์ Barcode” จะพาลูกค้าไปที่:

```text
https://warranty.yourcompany.com
```

ลูกค้าจะเห็นเฉพาะหน้าตรวจสอบสินค้าและกรอก SN เพื่อดูข้อมูล/ประกัน
