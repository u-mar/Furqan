import type { AppLanguage } from '@/lib/i18n-core'
import { HALAQA } from '@/lib/i18n-dict-halaqa'
import { QARI } from '@/lib/i18n-dict-qari'
import { READ } from '@/lib/i18n-dict-read'
import { LISTEN } from '@/lib/i18n-dict-listen'
import { ACCOUNT } from '@/lib/i18n-dict-account'
import { MISC } from '@/lib/i18n-dict-misc'

/*
 * Every screen writes its text in English and passes it through t(). This file
 * holds the Somali and Arabic for each English line; a line that is missing
 * here simply shows in English, so nothing breaks while it is being filled in.
 * Use {name} for a value that is filled in, e.g. t('{n} people', { n: 3 }).
 */
export type Dict = Record<string, Partial<Record<Exclude<AppLanguage, 'en'>, string>>>

const SETTINGS: Dict = {
  /* Settings */
  Settings: { so: 'Dejinta', ar: 'الإعدادات' },
  Back: { so: 'Dib', ar: 'رجوع' },
  'Add account': { so: 'Ku dar akoon', ar: 'إضافة حساب' },
  'Sign in to share your recitations': { so: 'Gal si aad u wadaagto akhrintaada', ar: 'سجّل الدخول لمشاركة تلاواتك' },
  Appearance: { so: 'Muuqaalka', ar: 'المظهر' },
  Light: { so: 'Iftiin', ar: 'فاتح' },
  Dark: { so: 'Mugdi', ar: 'داكن' },
  Black: { so: 'Madow', ar: 'أسود' },
  Language: { so: 'Luuqadda', ar: 'اللغة' },
  'The language of the app’s menus and buttons.': { so: 'Luuqadda liisaska iyo badhamada app-ka.', ar: 'لغة قوائم التطبيق وأزراره.' },
  Reading: { so: 'Akhrinta', ar: 'القراءة' },
  'Mushaf page': { so: 'Bogga Mushafka', ar: 'صفحة المصحف' },
  'How the page sits on your screen in Read.': { so: 'Sida bogga ugu dhigan yahay shaashadaada ee Akhrinta.', ar: 'كيف تظهر الصفحة على شاشتك في القراءة.' },
  'Full width': { so: 'Ballaadhka buuxa', ar: 'العرض الكامل' },
  'Bigger script': { so: 'Far weyn', ar: 'خط أكبر' },
  Spaced: { so: 'Kala fogaysan', ar: 'بهوامش' },
  'Margins on the sides': { so: 'Hareeraha oo bannaan', ar: 'هوامش على الجانبين' },
  'Vertical page swipes': { so: 'Bogagga si toosan u dhaqaajin', ar: 'التنقل بين الصفحات عموديًا' },
  'Ayah wallpapers': { so: 'Sawirrada aayadaha', ar: 'خلفيات الآيات' },
  Translation: { so: 'Tarjumaad', ar: 'الترجمة' },
  'Used in Read translation mode and when you double-tap an ayah.': {
    so: 'Waxaa loo isticmaalaa habka tarjumaadda ee Akhrinta iyo marka aad aayad laba jeer taabato.',
    ar: 'يُستخدم في وضع الترجمة في القراءة وعند الضغط مرّتين على آية.',
  },
  Offline: { so: 'Internet la’aan', ar: 'دون اتصال' },
  'Quran for offline': { so: 'Quraanka internet la’aan', ar: 'القرآن دون اتصال' },
  Downloaded: { so: 'La soo dejiyay', ar: 'تم التنزيل' },
  'Not saved': { so: 'Lama keydin', ar: 'غير محفوظ' },
  Support: { so: 'Taageero', ar: 'الدعم' },
  'Send feedback': { so: 'Soo dir fikrad', ar: 'إرسال ملاحظات' },
  'A bug, an idea or a request — it all helps.': { so: 'Cillad, fikrad ama codsi — dhammaantood way caawinayaan.', ar: 'خطأ أو فكرة أو طلب — كل ذلك يفيد.' },
  'Write your message…': { so: 'Qor fariintaada…', ar: 'اكتب رسالتك…' },
  Send: { so: 'Dir', ar: 'إرسال' },
  'Sending…': { so: 'Waa la dirayaa…', ar: 'جارٍ الإرسال…' },
  'Privacy Policy': { so: 'Siyaasadda Asturnaanta', ar: 'سياسة الخصوصية' },
  'Terms of Service': { so: 'Shuruudaha Adeegga', ar: 'شروط الخدمة' },
  'Sign out': { so: 'Ka bax', ar: 'تسجيل الخروج' },
  'Signed out.': { so: 'Waad ka baxday.', ar: 'تم تسجيل الخروج.' },
  'Delete account': { so: 'Tirtir akoonka', ar: 'حذف الحساب' },
  'For Sadaqah Jariyah': { so: 'Sadaqo Jaariya ah', ar: 'صدقة جارية' },
}

export const DICT: Dict = { ...SETTINGS, ...HALAQA, ...QARI, ...READ, ...LISTEN, ...ACCOUNT, ...MISC }
