import test from 'node:test';
import assert from 'node:assert/strict';
import {videoSource,videoThumbnails} from '../src/video-source.ts';
import seed from './data/initial-portfolio.json' with {type:'json'};
test('all bundled stock video URLs resolve to in-app media sources',()=>{for(const d of seed.developments)for(const url of d.videos)assert.ok(videoSource(url),url);});
test('provider URLs preserve video identity and privacy hashes without arbitrary iframe destinations',()=>{
 assert.equal(videoSource('https://youtu.be/M7lc1UVf-VE?t=20').src,'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&start=20');
 assert.equal(videoSource('https://www.youtube.com/shorts/M7lc1UVf-VE').kind,'embed');
 assert.equal(videoSource('https://vimeo.com/123456/abc123').src,'https://player.vimeo.com/video/123456?h=abc123&dnt=1');
 assert.equal(videoSource('https://player.vimeo.com/video/123456?h=abc123').src,'https://player.vimeo.com/video/123456?h=abc123&dnt=1');
 assert.equal(videoSource('https://players.brightcove.net/123/default_default/index.html?videoId=456&autoplay=true').src,'https://players.brightcove.net/123/default_default/index.html?videoId=456&playsinline=true');
 assert.equal(videoSource('https://cdn.example/video.mp4?signature=abc').kind,'file');
 for(const url of ['javascript:alert(1)','http://youtu.be/M7lc1UVf-VE','https://www.youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://evil.test/embed/123','https://user:secret@youtu.be/M7lc1UVf-VE'])assert.equal(videoSource(url),null);
});
test('video posters use a real YouTube thumbnail with development and illustration fallbacks',()=>{
 assert.deepEqual(videoThumbnails('https://youtu.be/M7lc1UVf-VE','/cover.jpg'),['https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg','/cover.jpg','/images/city.svg']);
 assert.deepEqual(videoThumbnails('https://players.brightcove.net/123/default_default/index.html?videoId=456','/cover.jpg'),['/cover.jpg','/images/city.svg']);
 assert.deepEqual(videoThumbnails('https://cdn.example/video.mp4'),['/images/city.svg']);
});
