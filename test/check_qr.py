"""Vérifie que les QR générés sont lisibles (OpenCV) et que le zip est valide."""
import sys, glob, zipfile, os
import numpy as np
import cv2

here = os.path.join(os.path.dirname(__file__), 'out')
ok = True
for f in sorted(glob.glob(os.path.join(here, 'qr*.txt'))):
    lines = open(f).read().split('\n')
    url, rows = lines[0], lines[1:]
    m = np.array([[0 if c == '1' else 255 for c in r] for r in rows], dtype=np.uint8)
    m = np.pad(m, 4, constant_values=255)
    img = cv2.resize(m, None, fx=10, fy=10, interpolation=cv2.INTER_NEAREST)
    data, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    print(os.path.basename(f), 'OK' if data == url else 'ECHEC', '| v', (len(rows) - 17) // 4)
    ok &= data == url

z = zipfile.ZipFile(os.path.join(here, 'theme.zip'))
assert z.testzip() is None
print('zip:', z.namelist())
sys.exit(0 if ok else 1)
