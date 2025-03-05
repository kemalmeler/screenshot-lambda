# Web Screenshot Lambda Function

Bu AWS Lambda fonksiyonu, herhangi bir web sitesinin ekran görüntüsünü otomatik olarak alır ve AWS S3 bucket'ına kaydeder. Özellikle TradingView, CoinMarketCap gibi dinamik web siteleri için optimize edilmiştir.

## Özellikler

- Herhangi bir web sitesinin otomatik ekran görüntüsünü alma
- Özelleştirilebilir bekleme süreleri ve CSS selektörleri
- Otomatik dosya isimlendirme (URL ve zaman damgası bazlı)
- AWS S3'e otomatik yükleme
- N8N ile entegrasyon desteği
- Hata yönetimi ve detaylı loglama

## Ön Gereksinimler

1. AWS Hesabı
2. Node.js (v14 veya üzeri)
3. AWS CLI
4. PowerShell veya Bash
5. N8N (opsiyonel)

## Kurulum Adımları

### 1. AWS CLI Kurulumu ve Yapılandırma

1. [AWS CLI'ı indirin ve kurun](https://aws.amazon.com/cli/)
2. AWS CLI'ı yapılandırın:
```bash
aws configure
```
Aşağıdaki bilgileri girin:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: eu-central-1 (veya kendi bölgeniz)
- Default output format: json

### 2. S3 Bucket Oluşturma

1. AWS Console'da S3 servisine gidin veya AWS CLI kullanın:
```bash
# Bucket oluşturma
aws s3 mb s3://your-bucket-name

# CORS yapılandırması (gerekirse)
aws s3api put-bucket-cors --bucket your-bucket-name --cors-configuration file://cors.json
```

### 3. IAM Rol ve Politikaları

1. Lambda için IAM rol oluşturun:
```bash
# Rol oluşturma
aws iam create-role --role-name lambda-screenshot-role --assume-role-policy-document file://trust-policy.json

# Gerekli politikaları ekleyin
aws iam attach-role-policy --role-name lambda-screenshot-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam attach-role-policy --role-name lambda-screenshot-role --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

### 4. Lambda Fonksiyonu Oluşturma

1. Proje dizininde gerekli dosyaları oluşturun:
```bash
mkdir screenshot-lambda
cd screenshot-lambda
```

2. Package.json oluşturun:
```json
{
  "name": "web-screenshot-lambda",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.478.0",
    "@sparticuz/chromium": "^119.0.2",
    "puppeteer-core": "^21.6.1"
  }
}
```

3. Bağımlılıkları yükleyin:
```bash
npm install
```

4. Lambda fonksiyonu kodunu (index.mjs) oluşturun ve düzenleyin

5. Deployment paketi oluşturun:
```powershell
# PowerShell
Compress-Archive -Path .\index.mjs,.\node_modules,.\package.json -DestinationPath function.zip -Force

# Bash
zip -r function.zip index.mjs node_modules package.json
```

6. Lambda fonksiyonunu oluşturun:
   ```bash
   # Önce zip dosyasını S3'e yükleyin
   aws s3 cp function.zip s3://your-bucket-name/function.zip

   # Lambda fonksiyonunu S3'teki zip dosyası ile oluşturun
   aws lambda create-function \
     --function-name web-screenshot \
     --runtime nodejs18.x \
     --handler index.handler \
     --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-screenshot-role \
     --code S3Bucket=your-bucket-name,S3Key=function.zip \
     --timeout 300 \
     --memory-size 2048 \
     --environment Variables={S3_BUCKET_NAME=your-bucket-name}
   ```

   Alternatif olarak PowerShell için:
   ```powershell
   # Önce zip dosyasını S3'e yükleyin
   aws s3 cp function.zip s3://your-bucket-name/function.zip

   # Lambda fonksiyonunu S3'teki zip dosyası ile oluşturun
   aws lambda create-function `
     --function-name web-screenshot `
     --runtime nodejs18.x `
     --handler index.handler `
     --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-screenshot-role `
     --code S3Bucket=your-bucket-name,S3Key=function.zip `
     --timeout 300 `
     --memory-size 2048 `
     --environment "Variables={S3_BUCKET_NAME=your-bucket-name}"
   ```

### 5. Lambda Fonksiyonunu Güncelleme

Kod değişikliklerinden sonra:
```bash
# Zip oluştur
Compress-Archive -Path .\index.mjs,.\node_modules,.\package.json -DestinationPath function.zip -Force

# S3'e yükle
aws s3 cp function.zip s3://your-bucket-name/function.zip

# Lambda'yı güncelle
aws lambda update-function-code --function-name web-screenshot --s3-bucket your-bucket-name --s3-key function.zip
```

### 6. Lambda Fonksiyonunu Test Etme

1. Test payload'ı oluşturun:
```json
{
  "url": "https://www.tradingview.com/chart/?symbol=BITSTAMP%3ABTCUSD",
  "waitForSelector": ".chart-container",
  "waitTime": 20000
}
```

2. Fonksiyonu test edin:
```bash
aws lambda invoke --function-name web-screenshot \
  --cli-binary-format raw-in-base64-out \
  --payload file://test-payload.json \
  output.json
```

## N8N ile Entegrasyon

### 1. N8N Kurulumu

1. [N8N'i kurun](https://docs.n8n.io/hosting/installation/npm/)
2. N8N'i başlatın ve web arayüzüne erişin

### 2. AWS Credentials Ayarları

1. N8N'de "Credentials" bölümüne gidin
2. "New Credentials" > "AWS" seçin
3. AWS kimlik bilgilerini girin:
   - Access Key ID
   - Secret Access Key
   - Region: Lambda fonksiyonunuzun bulunduğu bölge

### 3. Workflow Oluşturma

1. Yeni bir workflow oluşturun
2. AWS Lambda node'u ekleyin
3. Yapılandırma:
   - Function: web-screenshot
   - Payload örneği:
   ```json
   {
     "url": "https://www.example.com",
     "waitForSelector": "body",
     "waitTime": 5000
   }
   ```

## Fonksiyon Parametreleri

| Parametre | Tip | Zorunlu | Varsayılan | Açıklama |
|-----------|-----|---------|------------|-----------|
| url | string | Hayır | TradingView BTC/USD | Screenshot alınacak URL |
| waitForSelector | string | Hayır | .chart-container | Beklenecek CSS selektörü |
| waitTime | number | Hayır | 20000 | Render için bekleme süresi (ms) |
| viewport | object | Hayır | {width: 1920, height: 1080} | Ekran boyutu |
| fullPage | boolean | Hayır | false | Tam sayfa screenshot |

## Çıktı Formatı

Fonksiyon başarılı olduğunda sadece S3 key'ini döndürür:
```
screenshots/www_example_com_2025-02-12T21-45-47-452Z.png
```

## Hata Yönetimi

Fonksiyon hata durumunda bir hata fırlatır. N8N'de bu hataları yakalamak için "Error Workflow" kullanabilirsiniz.

## Güvenlik Notları

1. IAM rollerini "en az ayrıcalık" prensibine göre yapılandırın
2. S3 bucket'ınızı uygun şekilde yapılandırın
3. API Key'leri ve hassas bilgileri her zaman çevre değişkenlerinde saklayın
4. Lambda fonksiyonunun timeout ve memory ayarlarını optimize edin

## Katkıda Bulunma

1. Bu repo'yu fork edin
2. Feature branch'i oluşturun
3. Değişikliklerinizi commit edin
4. Branch'inizi push edin
5. Pull request oluşturun

## Lisans

MIT

## İletişim

Sorunlar ve öneriler için Issues bölümünü kullanabilirsiniz. 