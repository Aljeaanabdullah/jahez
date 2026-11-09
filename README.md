# Jahez — نظام تحضير الموظفين

تحضير الموظفين بتصوير الوجه والتحقق من الموقع، مع وحدة طوارئ لإخلاء المباني.

- المتطلبات: [docs/PRD.md](docs/PRD.md)
- خطة التنفيذ: [docs/PLAN.md](docs/PLAN.md)

## هيكل المستودع

| المجلد | المحتوى |
|---|---|
| `apps/mobile` | تطبيق الجوال (Flutter) لـ iOS وAndroid |
| `apps/admin` | لوحة التحكم (Next.js) |
| `supabase/` | إعدادات قاعدة البيانات والجداول والدوال |
| `docs/` | الوثائق |

## المتطلبات على الجهاز

- **Node.js** الإصدار 24 أو أحدث
- **Flutter** الإصدار 3.47 (القناة المستقرة)
- **Android Studio**: لتشغيل محاكي Android (يُحتاج من المرحلة 2)

## التشغيل

### لوحة التحكم
```bash
cd apps/admin
npm install
npm run dev
```
ثم افتح http://localhost:3000

### تطبيق الجوال
```bash
cd apps/mobile
flutter pub get
flutter run
```

## نموذج الوجه ومحاكي أندرويد

- نموذج الوجه نفسه يعمل في الويب والجوال. طريقة بنائه واختباره في [tools/face-model/README.md](tools/face-model/README.md).
- اختبار النموذج داخل المحاكي أو الجوال:

```bash
node tools/face-model/make_mobile_parity.mjs
cd apps/mobile
flutter test integration_test/face_model_test.dart -d emulator-5554
```

- تشغيل التطبيق على المحاكي: `flutter run -d emulator-5554` (المحاكي اسمه jahez، وكاميرته الأمامية هي كاميرا اللابتوب).

## الإعدادات

انسخ `.env.example` إلى `apps/admin/.env.local` وضع فيه المفاتيح. **لا ترفع ملفات المفاتيح إلى GitHub أبداً.**

## البيانات الوهمية واختبارات الصلاحيات

تحتاج المفتاح السري في `apps/admin/.env.local`.

```bash
cd supabase/scripts
npm install
npm run demo:seed
npm run test:rls
npm run demo:reset
```

- `demo:seed`: ينشئ 3,500 موظف وهمي وحسابات دخول تجريبية، وكلمات المرور تُحفظ في `supabase/scripts/.demo-credentials.json` (لا يُرفع إلى GitHub).
- `test:rls`: يختبر صلاحيات كل دور.
- `demo:reset`: يحذف البيانات الوهمية، ويُبقي حساب مدير النظام 735043.

## اختبارات لوحة التحكم

```bash
cd apps/admin
npm test          # اختبارات قواعد الإدخال
npm run test:e2e  # اختبارات المتصفح (Playwright)، تحتاج المفتاح السري
```

اختبارات المتصفح تنشئ حسابات مؤقتة (799901–799903) بكلمات مرور عشوائية لا تُعرض، وتحذفها مع كل ما أنشأته عند الانتهاء.

## الفحص الآلي

مع كل Pull Request يشغّل GitHub الفحوصات التالية:
- لوحة التحكم: فحص الكود، واختبارات قواعد الإدخال، والبناء.
- تطبيق الجوال: فحص الكود والاختبارات.
- البحث عن أي مفاتيح سرية داخل المستودع.
