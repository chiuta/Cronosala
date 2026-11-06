# Teste

Patru suite care rulează aplicația într-un Chrome real (puppeteer-core, ceas simulat):

| Fișier | Ce verifică |
|---|---|
| `test.js` | încărcare, constructori, fuzz, stocare coruptă, motor, istoric, Space/Back, layout-uri de bază, catalog, a11y, performanță, reluare, CSP |
| `test2.js` | jurnal kg×rep, pauză adaptivă, progresie, aparat ocupat, program lunar, mod în doi, partajare, scanner, etichete, voce, export/import |
| `test3.js` | adversarial: XSS, stocare ostilă, hash malițios, API-uri lipsă, fuzz de 4000 de operații, dialoguri concurente, QR aleatoriu, salturi de ceas |
| `test4.js` | responsiv: 14 viewport-uri (320×568 … 2560×1440), depășiri, decupări în overlay, ținte tactile |

```bash
npm install
# Chrome/Chromium: CHROME_PATH=/calea/spre/chrome (implicit /usr/bin/google-chrome)
# Pentru verificarea codurilor QR (test2, test3): pip install opencv-python-headless zxing-cpp numpy
npm test
```
