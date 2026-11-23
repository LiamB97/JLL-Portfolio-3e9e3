import {canManagePortfolioStock,canReviewDevelopments} from '../shared/staff-roles.ts';

export function staffGuide(role) {
 const stock = canManagePortfolioStock(role);
 const reviewChapter = {id:'reviews',title:'Keep assigned development reviews current',steps:[
  'Open Development reviews from Overview or the sidebar. Use View development to check the published description, pricing and availability.',
  'Use Bedroom prices to enter confirmed starting prices by bedroom type. Leave unknown prices blank.',
  stock ? 'Make other stock edits in Developments.' : 'Send corrections to descriptions, images or availability to an Admin or Broker admin.',
  'Select Confirm details once the published information is correct. This starts a new 14-day period for your assignment. Other reviewers on the same development have their own review dates.',
  'Check due dates in the workspace. Email reminders require configured sender details.',
 ]};
 const pricesFaq = {id:'prices',question:'Where do I add bedroom prices or confirm a review?',answer:'Open Development reviews and use Bedroom prices on one of your assigned homes. Once the listing is correct, select Confirm details to start a new 14-day review period.'};
 if(role === 'development_consultant') return {
  title:'Development consultant guide', role,
  chapters:[reviewChapter,{id:'profile',title:'Sign in and get help',steps:[
   'Open https://digitalportfolio.live.jll.com/#admin and sign in with your JLL email.',
   'To activate a new invitation, use the matching work email and choose a password of at least 12 characters. The WhatsApp field is optional for this role.',
   'Ask an Admin to assign developments, reissue an expired invitation or help with your account.',
  ]}],
  faqs:[pricesFaq,{id:'review-scope',question:'How do I correct a description, photo or availability?',answer:'Send the development name and verified correction to an Admin or Broker admin. Confirm the review once the published details are correct.'}],
 };
 return {
  title: 'How the portfolio works for your team', role,
  chapters: [
   {id:'profile',title:'Get started and personalise your profile',steps:[
    'The live portfolio is https://digitalportfolio.live.jll.com. Use Staff workspace in the menu, or open /#admin to sign in. Existing accounts and passwords work on this address.',
    'New colleagues open their own invitation, enter the matching JLL email, choose a password of at least 12 characters and add an international WhatsApp number. Invitations are single-use and expire after seven days. Existing staff should use their current account.',
    'In My profile, check your WhatsApp number, name and job title. Upload a JPEG, PNG or WebP in Your broker photo, adjust its position and zoom, then Save photo. Your photo appears on buyer links and newly generated brochures.',
    'Your personal and collection links show your name and WhatsApp contact. Your work email appears in brochures. Profile changes update existing buyer links; regenerate saved PDFs to update their contact details.',
    'Overview puts collections and PDFs first, with personal and Your First Home links in Sharing. Use Workspace section on mobile. Switching sections preserves in-progress forms in the current tab; refresh or sign-out clears unsaved work.'
   ]},
   {id:'share',title:'Share your personal portfolio link',steps:[
    'In My profile, use Copy my portfolio link to share the available London portfolio with your own WhatsApp contact attached. Preview it before sending.',
    'The generic portfolio address routes development enquiries to JLL Residential. Personal and ordinary collection links route them to their owning broker. Your First Home links copied from your workspace also use your own contact; the public campaign link uses the team contact.',
    'Prepare email copies suggested wording or opens your email app. Add the recipient and review before sending. WhatsApp opens a draft conversation. Neither action sends a message automatically.',
    'If an Admin protects the full portfolio, your buyer password appears in My profile. Share it separately from the buyer link. Your staff sign-in password is never a buyer password.'
   ]},
   {id:'collections',title:'Create a collection for a buyer',steps:[
    'Open Buyer collections → New collection. Choose a general title and 1–50 published developments. Keep buyer names and other personal details out of titles.',
    'Map layers on opening lets you choose transport lines or specific stations for that collection. General portfolio links open with optional overlays off. Selected stations have prominent markers and visible names.',
    'Create buyer link, then preview it. Your picks appear first in List and Split with featured styling, and the map initially frames your selection. View picks returns to the selection; Picked homes only filters results. Other homes remain available unless access settings restrict the collection.',
    'Tick Password protect this collection before saving to generate a buyer password. Share the password separately. Replace collection password invalidates the previous password without changing the link.',
    'Save changes before sharing an edited collection. Existing links use the latest saved selection and their owner’s current WhatsApp details. Removing a collection stops its link. Admins can manage all collections; editing someone else’s collection does not change its contact.'
   ]},
   {id:'brochures',title:'Create and save a PDF brochure',steps:[
    'Open PDF brochures and choose up to 20 published developments, or start from a saved buyer collection. Reorder the homes and add an optional client name, introduction and notes.',
    'The brochure includes the shared London skyline, a numbered shortlist map, a page for each development and a viewing invitation. The PDF uses your profile photo, name, job title, WhatsApp number and work email.',
    'Generate & save PDF, then check the preview for photos, bedroom prices and shortened copy. Confirm prices and availability before sharing.',
    'Outlook draft · PDF attached downloads an .eml message containing the PDF. Open it in Outlook, add the recipient and review before sending. WhatsApp downloads a PDF for you to attach manually. Share file uses a supported device share sheet. Nothing is sent automatically.',
    'Save brochure keeps private settings. Generate & save PDF also stores PDFs up to 3.5MB. Saved brochures allows 50 brochures / 100MB per broker; larger PDFs remain downloadable. A PDF is a snapshot: regenerate it for current prices, stock or profile details.'
   ]},
   {id:'buyers',title:'Help buyers explore and shortlist',steps:[
    'Buyers can switch Map, Split and List. Desktop opens in Split and mobile in Map, with view choices in the menu. Search a development, area or postcode and filter by region, nearby area, bedrooms and starting-price budget. Named areas use a 2 km radius; regions are approximate.',
    'Map layers adds universities, landmarks, TfL lines and stations. Turn on stations and use Highlight specific stations, or open a station and choose Highlight station. Highlighted stations stand out with visible names. Other labels appear where space allows; zoom in for more.',
    'Find homes by commute checks a destination postcode, travel mode, arrival date/time and journey-time limit using confirmed TfL journeys. List and Split then default to Shortest journey. This sorts by travel time, not straight-line distance; unconfirmed routes are reported separately.',
    'Development details include photos, Watch Video where available, amenities, transport and a sticky WhatsApp enquiry action. A viewing message is a request, not a confirmed booking. Nearby walking/cycling links and the destination form open Google Maps for route options.',
    'Heart buttons save favourites on the buyer’s current browser/device. Favourites and Show favourites only help them share a shortlist. English, Arabic, Simplified Chinese and Turkish and Light, Dark or Automatic appearance are in the menu.',
    'Prices are starting points. With a bedroom filter, missing confirmed prices for that bedroom type are not replaced by another unit type’s price. Check suitable homes, availability, translations and travel estimates with the buyer.'
   ]},
   {id:'your-first-home',title:'Use the shared Your First Home preview',steps:[
    'Your First Home is pinned on Overview and in Buyer collections, with its own workspace section. Copy your buyer link from the workspace. Enquiries from this link use your current profile WhatsApp number.',
    'This is being prepared ahead of scheme launch. Developments are potential options only: participation, individual home prices, availability and buyer eligibility remain unconfirmed. Do not describe a development or buyer as approved for the scheme.',
    'The standalone collection has Your First Home branding, pink pins, an illustrative calculator and expandable scheme FAQs. Use Calculator & FAQs for assumptions and government guidance links. Figures are calculated in the buyer’s browser and are not saved.',
    'The public Your First Home link and landing-page embed go to the shared team contact, initially James Dewhurst. Links copied from the broker workspace use the sharing broker’s WhatsApp number, including development enquiries and onward shortlist links. Add your number in My profile before sharing.',
    stock ? 'Admins and Broker admins manage the homes, local authorities, team WhatsApp number and optional password in Your First Home. Only selected developments with a recorded price within their local cap are shown. Save shared collection updates everyone’s existing link.' : 'Ask an Admin or Broker admin to change homes, the team contact or password settings. Share this managed collection rather than creating separate campaign copies.'
   ]},
   ...(canReviewDevelopments(role) ? [reviewChapter] : role === 'admin' ? [{id:'reviews',title:'Assign development reviews',steps:[
    'Open Review assignments under Portfolio stock. Choose a development, region and the Broker admins or Development consultants responsible for it.',
    'Several people can review the same development. Each reviewer confirms their own review. Check email delivery status on the assignment page.',
   ]}] : []),
   ...(stock ? [
    {id:'pending',title:'Complete Pending input',steps:[
     'Pending input lists requested developments. Existing listings are linked; unpublished entries stay private until reviewed and published.',
     'Use the missing-information checklist, source links and extraction history. Save assignment & notes at the top saves responsibility/team notes separately from Save development draft.',
     'Read source again fills empty saved fields. Save edits first. Check the exact location whenever coordinates were estimated from a postcode.',
     'Check prices, bedroom types, copy, location, media rights and photos, tick the review checkbox and publish. Conflicting edits are rejected. Mark as not required hides a queue entry without removing published stock.'
    ]},
    {id:'stock',title:'Add or update shared developments',steps:[
     'Developments opens on searchable published stock. Add / import & drafts supports manual entry, a website URL, pasted text or JSON. Imports start as unpublished drafts.',
     'An existing JLL URL loads its saved record for review. Sources may omit information or block requests; complete missing fields using verified information.',
     'Check name, area, postcode, location, bedroom/property types, prices and availability. Enter confirmed starting prices by bedroom type; leave unknown values blank. Postcode lookup is a centre point that needs checking.',
     'Choose a suitable cover, check media permissions and watermarks, Save draft or Preview as buyer. Review update to existing preserves the ID, buyer links and collection references. Confirm the review checkbox before publishing.'
    ]},
    {id:'refresh',title:'Review website updates',steps:[
     'Refresh JLL website stock checks website-managed developments. Automatic refresh also runs every six hours. Manual additions and field edits are preserved.',
     'Website changes needing review compares saved and website values. Check each change before keeping the manual value or accepting the incoming value. Bedroom prices are not replaced with a development-wide price.',
     'Missing website listings remain for review; deleted website records may return. Check with the responsible colleague before withdrawing shared stock.'
    ]}
   ] : [{id:'permissions',title:'Know your Broker access',steps:[
    'Brokers manage their own profile, collections, collection passwords and saved brochures, share Your First Home and invite new regular Brokers.',
    'Stock editing, imports, drafts and publishing are for Admins and Broker admins. Admins control portfolio-wide access, instructed-only settings, roles, review assignments and reporting.'
   ]}]),
   {id:'people',title:'Invitations and account access',steps:[
    role === 'admin' ? 'In People & roles, invite colleagues as Broker, Broker admin, Development consultant or Admin. Manage roles, access and password-reset invitations there.' : 'Invite brokers creates an invitation for a new regular Broker. Only Admins can reset existing accounts or assign other roles.',
    'Each named invitation requires its matching email, can be used once, expires after seven days and can be revoked. The app does not email invitations automatically.',
    'Use your own account and never send staff activation links to buyers. Disabling an account stops its personal and ordinary collection links. Ask an Admin for a new invitation if you forget your sign-in password.'
   ]},
   ...(role === 'admin' ? [
    {id:'buyer-access',title:'Control buyer access and instructed-only stock',steps:[
     'Open Buyer access from Overview or Team. Password protect the full portfolio generates a unique buyer password for accounts with buyer-sharing access, available in My profile.',
     'Show only JLL-instructed developments limits buyer portfolio and collection results to stock on the last verified JLL Residential new homes list. Save settings updates existing links; an excluded home can disappear from a saved collection.',
     'Replace password invalidates the previous buyer password. Collection passwords are managed separately in their editor. A collection password unlocks only selected homes when the full portfolio is protected.',
     'Buyer controls do not change staff roles or sign-in passwords. Check buyer previews after changing access or visibility settings.'
    ]},
    {id:'activity',title:'Review team activity',steps:[
     'Team activity reports sign-ins, last activity, link copies, share-button clicks, collection changes and stock activity separately from Google Analytics.',
     'Filter dates, staff or current role, compare the previous period, inspect a colleague’s breakdown and export summary or timeline CSV files.',
     'Buyer visits, views, favourites and WhatsApp clicks are anonymous counts recorded after analytics consent. They do not identify individual buyers or who forwarded a link.',
     'Link copies, WhatsApp clicks or opened email drafts do not confirm messages, enquiries or sales. Earlier unrecorded activity is unavailable.'
    ]},
    {id:'analytics',title:'Configure optional analytics',steps:[
     'Analytics connects a Google Analytics 4 Web stream using its public G-… Measurement ID. Use the JLL portfolio address for the stream. No API secret or redeploy is needed.',
     'Switch Enhanced measurement off in the GA4 stream before enabling selected events. Visitors accept or decline analytics and can change their choice in Preferences.',
     'Realtime checks setup. Standard reports may take 24–48 hours; visitors who decline or block analytics are excluded. Staff and invitation pages are excluded from Google Analytics.'
    ]}
   ] : [])
  ],
  faqs: [
   {id:'sign-in',question:'Where do I sign in, and do I need a new account for the JLL domain?',answer:'Use https://digitalportfolio.live.jll.com/#admin. Existing accounts and passwords still work. New staff activate their own invitation with the matching email, a password of at least 12 characters and an international WhatsApp number. Ask an Admin about expired invitations or password resets.'},
   {id:'broker-contact',question:'How do I make sure enquiries come to me?',answer:'Check your WhatsApp number in My profile and share Copy my portfolio link or one of your collections. Preview its contact. The generic address goes to JLL Residential; your personal Your First Home link uses your WhatsApp; the public campaign link goes to its team contact.'},
   {id:'collection-password',question:'Can every broker password protect a collection?',answer:'Yes. Tick Password protect this collection in Buyer collections and save. Share the generated buyer password separately. Replace or remove it without changing the link. Never share your staff sign-in password.'},
   {id:'selected-homes',question:'What will buyers see first in my collection?',answer:'Your picks appear first in List and Split with featured styling. The opening map frames them. View picks returns to your selection; Picked homes only filters results. Other homes depend on the current collection and portfolio access settings.'},
   {id:'travel',question:'Can I highlight a station or sort homes by commute?',answer:'In Map layers, turn on stations and use Highlight specific stations, or click a station and choose Highlight station. Find homes by commute checks a destination postcode and travel limit. List and Split default to Shortest journey using confirmed TfL durations.'},
   {id:'saved-pdfs',question:'Will a saved PDF update when stock or prices change?',answer:'No. A PDF is a snapshot. Reopen its saved settings, regenerate and review it before sending. Online collection links use the latest saved selection and published details.'},
   {id:'campaign',question:'Can I share Your First Home, and who receives enquiries?',answer:'Share the pinned collection from your workspace. It is being prepared ahead of scheme launch with potential homes only; participation and eligibility are unconfirmed. Calculator & FAQs contains the outline and guidance links. Your copied broker link routes enquiries to your profile WhatsApp. The public campaign link and landing-page embed route to the Your First Home team, initially James Dewhurst.'},
   {id:'buyer-data',question:'Do buyers register, and what does the portfolio track?',answer:'Buyers need no account or enquiry form; some links require a buyer password. Favourites stay in their browser/device. WhatsApp opens a separate conversation. Optional buyer analytics needs consent. Admins can review staff activity; this does not reveal who forwarded a buyer link.'},
   {id:'sending',question:'Does the portfolio send messages or book viewings automatically?',answer:'No. Share actions copy wording, prepare a draft or open another app. Review and send it yourself. Attach PDFs manually in WhatsApp, or open an Outlook draft with its PDF attached. A viewing request needs confirmation.'},
   ...(stock ? [
    ...(canReviewDevelopments(role) ? [pricesFaq] : []),
    {id:'website-edits',question:'Will website refresh overwrite our manual edits?',answer:'Manual field edits are preserved. Check Website changes needing review to accept an incoming value or keep the saved one. Review availability and missing website listings with the responsible colleague.'}
   ] : [{id:'stock-help',question:'How do I get an incorrect price, photo or description corrected?',answer:'Send an Admin or Broker admin the development name and the correction or source.'}]),
   ...(role === 'admin' ? [
    {id:'portfolio-password',question:'Where do I protect the whole portfolio or show instructed homes only?',answer:'Open Buyer access. Choose Password protect the full portfolio and/or Show only JLL-instructed developments, then Save settings. Staff find their individual buyer password in My profile. Preview buyer links after changing these settings.'},
    {id:'review-assignments',question:'Can two colleagues review the same home, and are reminder emails live?',answer:'Yes. In Review assignments, choose a development, region and its Broker admins or Development consultants. Each reviewer has their own review period. The page shows whether email delivery is configured.'}
   ] : [])
  ]
 };
}
