import {brochureShareLinks} from '../shared/brochure-sharing.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import {collectionInvitation,portfolioInvitation,portfolioEmail,emailHref,buyerShareLink,developmentLink,yourFirstHomeShareLink} from '../shared/sharing.ts';
import {YOUR_FIRST_HOME_SLUG} from '../shared/your-first-home.ts';
test('friend links retain collection ownership and drop staff fragments and unrelated parameters',()=>{
 const url=new URL(buyerShareLink('https://portfolio.example/?broker=wrong&collection=chosen&email=private#invite=secret','home-1'));
 assert.equal(url.href,'https://portfolio.example/?collection=chosen&development=home-1');
 assert.equal(buyerShareLink('https://portfolio.example/?broker=owner#admin'),'https://portfolio.example/?broker=owner');
 assert.equal(buyerShareLink('https://portfolio.example/?email=private#admin'),'https://portfolio.example/');
});
test('prepared collection emails preserve broker context on every development and never set a recipient',()=>{
 const email=portfolioEmail('https://portfolio.example/?collection=chosen',[{id:'home-1',name:'First Home',area:'Chelsea'},{id:'home-2',name:'Second Home',area:'Battersea'}],'Homes for you\r\nBcc: unwanted');
 assert.ok(email.body.includes('development=home-1&collection=chosen'));assert.ok(email.body.includes('development=home-2&collection=chosen'));assert.ok(email.body.includes(portfolioInvitation));
 const href=emailHref(email.subject,email.body);assert.ok(href.startsWith('mailto:?subject='));assert.ok(!new URL(href).pathname);assert.ok(!new URL(href).searchParams.has('bcc'));assert.ok(!email.subject.includes('\n'));
 const own=portfolioEmail('https://portfolio.example/?broker=owner',[{id:'home-1',name:'Home',area:'Angel'}]);assert.ok(own.body.includes('development=home-1&broker=owner'));
});

test('brochure WhatsApp and email links open their services with broker attribution and no automatic recipient',()=>{
 const links=brochureShareLinks('https://portfolio.example','my-broker','selected','Your cover title\r\nBcc: unexpected','Broker Name');
 const whatsapp=new URL(links.whatsapp);assert.equal(whatsapp.hostname,'wa.me');assert.ok(whatsapp.searchParams.get('text').includes('collection=selected'));assert.ok(!whatsapp.searchParams.get('text').includes('my-broker'));
 const email=new URL(links.email);assert.equal(email.protocol,'mailto:');assert.equal(email.pathname,'');assert.ok(email.searchParams.get('subject').startsWith('Your cover title'));assert.ok(!email.searchParams.has('bcc'));assert.ok(!email.searchParams.get('subject').includes('\n'));
 assert.ok(brochureShareLinks('https://portfolio.example','my-broker','','A title','Broker').portfolio.includes('broker=my-broker'));
});

test('translated collection and brochure messages preserve the buyer language in every link',()=>{
 const origin='https://portfolio.example',home={id:'home-1',name:'First Home',area:'Chelsea'};
 for(const [language,salutation] of [['zh-CN','您好'],['tr','Merhaba'],['ar','مرحباً']]){
  const link=origin+'/?collection=selected&lang='+language;
  assert.ok(collectionInvitation(link).endsWith(link));
  assert.ok(!collectionInvitation(link).startsWith(portfolioInvitation));
  const email=portfolioEmail(link,[home],'Selected homes');
  assert.ok(email.body.startsWith(salutation));
  assert.ok(email.body.includes('development=home-1&collection=selected&lang='+language));
  const onward=new URL(buyerShareLink(link+'&contact=wechat#admin',home.id));
  assert.equal(onward.searchParams.get('lang'),language);
  assert.equal(onward.searchParams.has('contact'),false);
  assert.equal(onward.hash,'');
  const brochure=brochureShareLinks(origin,'owner','selected','Title','Broker',language);
  assert.ok(new URL(brochure.email).searchParams.get('body').startsWith(salutation));
  assert.equal(new URL(brochure.portfolio).searchParams.get('lang'),language);
  assert.equal(new URL(brochure.portfolio).searchParams.has('broker'),false);
 }
 assert.equal(new URL(buyerShareLink(origin+'/?lang=unknown')).searchParams.has('lang'),false);
});

test('Your First Home links keep the sharing broker through onward links, development emails and brochure shares',()=>{
 const origin='https://portfolio.example',broker='sharing-broker';
 const link=yourFirstHomeShareLink(origin,broker),params=new URL(link).searchParams;
 assert.equal(params.get('collection'),YOUR_FIRST_HOME_SLUG);assert.equal(params.get('broker'),broker);
 assert.equal(new URL(yourFirstHomeShareLink(origin)).searchParams.has('broker'),false);
 for(const collection of [YOUR_FIRST_HOME_SLUG,'your-first-home']){
  const incoming=origin+'/?collection='+collection+'&broker='+broker+'&email=private&embed=1#invite=secret';
  const friend=new URL(buyerShareLink(incoming,'chosen-home'));
  assert.equal(friend.searchParams.get('broker'),broker);assert.equal(friend.searchParams.get('collection'),collection);
  assert.equal(friend.searchParams.get('development'),'chosen-home');assert.equal(friend.hash,'');
  assert.deepEqual([...friend.searchParams.keys()].sort(),['broker','collection','development']);
  assert.equal(new URL(developmentLink(origin,'chosen-home',collection,broker)).searchParams.get('broker'),broker);
  const email=portfolioEmail(incoming,[{id:'chosen-home',name:'Home',area:'London'}]);
  assert.ok(email.body.includes(developmentLink(origin,'chosen-home',collection,broker)));
  assert.equal(new URL(brochureShareLinks(origin,broker,collection,'Homes','Broker').portfolio).searchParams.get('broker'),broker);
  assert.equal(new URL(developmentLink(origin,'chosen-home',collection,'your-first-home')).searchParams.has('broker'),false);
 }
 assert.equal(new URL(developmentLink(origin,'chosen-home','ordinary',broker)).searchParams.has('broker'),false);
});
