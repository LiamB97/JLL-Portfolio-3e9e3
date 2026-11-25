import type {BuyerLanguage} from './buyer-language.ts';

export const shareCopy = {
  en: {
    invite: 'Explore the JLL New Homes Portfolio', subject: 'Your JLL New Homes Portfolio',
    privateSubject: 'Your private JLL portfolio link', greeting: 'Hello,', signoff: 'Best wishes',
    picks: 'I have picked these developments for you to explore:',
    portfolio: 'Explore our new homes, save your favourites and see how each neighbourhood connects across London.',
    contact: 'Use the WhatsApp button on the portfolio to come back to me with any questions, or reply to this email.',
    contactOptions: 'You can contact me through the portfolio or reply to this email.',
    brochure: 'I’ve put together a selection of London homes for you: {title}.',
    online: 'Explore the portfolio online:',
  },
  'zh-CN': {
    invite: '浏览仲量联行新住宅精选', subject: '您的仲量联行新住宅精选', privateSubject: '您的仲量联行私人访问链接',
    greeting: '您好！', signoff: '祝好',
    picks: '我为您精选了以下项目，欢迎查看：',
    portfolio: '欢迎浏览我们的新住宅、收藏心仪项目，并了解伦敦各街区的交通。',
    contact: '如有疑问，您可以通过房源页面上的联系方式联系我，或直接回复这封邮件。',
    contactOptions: '如有疑问，您可以通过房源页面上的联系方式联系我，或直接回复这封邮件。',
    brochure: '我为您整理了一份伦敦住宅精选：《{title}》。',
    online: '在线查看住宅精选：',
  },
  tr: {
    invite: 'JLL Yeni Konut Portföyünü Keşfedin', subject: 'JLL Yeni Konut Portföyünüz', privateSubject: 'Size özel JLL portföy bağlantısı',
    greeting: 'Merhaba,', signoff: 'Saygılarımla',
    picks: 'İncelemeniz için şu projeleri seçtim:',
    portfolio: 'Yeni konutlarımızı inceleyin, beğendiklerinizi kaydedin ve Londra’nın farklı bölgelerinin ulaşım bağlantılarını keşfedin.',
    contact: 'Sorularınız için portföydeki iletişim seçeneklerini kullanabilir veya bu e-postayı yanıtlayabilirsiniz.',
    contactOptions: 'Sorularınız için portföydeki iletişim seçeneklerini kullanabilir veya bu e-postayı yanıtlayabilirsiniz.',
    brochure: 'Sizin için Londra’da bir konut seçkisi hazırladım: {title}.',
    online: 'Portföyü çevrimiçi inceleyin:',
  },
  ar: {
    invite: 'استكشف محفظة JLL للمنازل الجديدة', subject: 'محفظتك للمنازل الجديدة من JLL', privateSubject: 'رابط محفظة JLL الخاص بك',
    greeting: 'مرحباً،', signoff: 'مع أطيب التحيات',
    picks: 'اخترت لك هذه المشاريع لتطّلع عليها:',
    portfolio: 'تصفّح منازلنا الجديدة واحفظ ما يعجبك وتعرّف على خيارات التنقّل بين أحياء لندن.',
    contact: 'إذا كانت لديك أسئلة، يمكنك التواصل معي من خلال المحفظة أو الرد على هذه الرسالة.',
    contactOptions: 'إذا كانت لديك أسئلة، يمكنك التواصل معي من خلال المحفظة أو الرد على هذه الرسالة.',
    brochure: 'أعددت لك مجموعة مختارة من المنازل في لندن: {title}.',
    online: 'اطّلع على المحفظة عبر الإنترنت:',
  },
} satisfies Record<BuyerLanguage, {
  invite: string; subject: string; privateSubject: string; greeting: string; signoff: string; picks: string;
  portfolio: string; contact: string; contactOptions: string; brochure: string; online: string;
}>;
