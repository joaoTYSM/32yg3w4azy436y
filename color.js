/*

MIT License

Copyright (c) 2023 Luuk de Vlieger

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

var colorjs=function(r){"use strict";var a=(r,a)=>{var t=r.map((r=>{var t=Array.isArray(r)?r:r.split(",").map(Number);return"hex"===a.format?e(t):t}));return 1===a.amount||1===t.length?t[0]:t},t=(r,a)=>{var t=Math.round(r/a)*a;return Math.min(t,255)},e=r=>"#"+r.map((r=>{var a=r.toString(16);return 1===a.length?"0"+a:a})).join(""),n=(r,t)=>{for(var e=4*t.sample,n=r.length/e,o={r:0,g:0,b:0},g=0;g<r.length;g+=e)o.r+=r[g],o.g+=r[g+1],o.b+=r[g+2];return a([[Math.round(o.r/n),Math.round(o.g/n),Math.round(o.b/n)]],t)},o=(r,e)=>{for(var n=4*e.sample,o={},g=0;g<r.length;g+=n){var m=[t(r[g],e.group),t(r[g+1],e.group),t(r[g+2],e.group)].join();o[m]=o[m]?o[m]+1:1}return a(Object.entries(o).sort((([r,a],[t,e])=>a>e?-1:1)).slice(0,e.amount).map((([r])=>r)),e)},g=(r,a,t)=>new Promise(((e,n)=>{return(o=(r=>"string"==typeof r?r:r.src)(a),new Promise(((r,a)=>{var t=document.createElement("canvas"),e=t.getContext("2d"),n=new Image;n.onload=()=>{t.height=n.height,t.width=n.width,e.drawImage(n,0,0);var a=e.getImageData(0,0,n.width,n.height).data;r(a)},n.onerror=()=>a(Error("Image loading failed.")),n.crossOrigin="",n.src=o}))).then((a=>e(r(a,(({amount:r=3,format:a="array",group:t=20,sample:e=10}={})=>({amount:r,format:a,group:t,sample:e}))(t))))).catch((r=>n(r)));var o}));return r.average=(r,a)=>g(n,r,a),r.prominent=(r,a)=>g(o,r,a),r}({});