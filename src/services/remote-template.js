const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');
const { safeHttpUrl } = require('../utils/text');

const blocked = new net.BlockList();
for (const [ip, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(ip,bits,'ipv4');
blocked.addSubnet('2001:db8::',32,'ipv6');
blocked.addSubnet('2001::',32,'ipv6');
blocked.addSubnet('2002::',16,'ipv6');
function isPublicAddress(address) {
  if (net.isIP(address) === 4) return !blocked.check(address,'ipv4');
  // Only global unicast, excluding mapped IPv4, local, multicast and tunnelling ranges.
  if (net.isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !blocked.check(address,'ipv6');
  return false;
}
const invalid = message => Object.assign(new Error(message),{status:400});
async function loadRemoteTemplate(value) {
  const safe = safeHttpUrl(value,{httpsOnly:true});
  if (!safe) throw invalid('La plantilla remota necesita una URL HTTPS válida.');
  const url = new URL(safe);
  if (url.port && url.port !== '443') throw invalid('La plantilla remota sólo admite el puerto HTTPS 443.');
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=net.isIP(hostname) ? [{address:hostname,family:net.isIP(hostname)}] : await dns.lookup(hostname,{all:true});
  if (!addresses.length || addresses.some(row=>!isPublicAddress(row.address))) throw invalid('La plantilla remota no puede apuntar a una red privada o reservada.');
  const pinned=addresses[0];
  const limit=12*1024*1024;
  return new Promise((resolve,reject)=>{
    // DNS is resolved once and pinned for this connection (no DNS rebinding).
    const request=https.get(url,{lookup:(_host,opts,callback)=>opts.all ? callback(null,[pinned]) : callback(null,pinned.address,pinned.family)},response=>{
      if(response.statusCode!==200){response.resume();request.destroy(invalid('No se pudo descargar la plantilla (redirecciones no permitidas).'));return;}
      const type=String(response.headers['content-type']||'').split(';')[0];
      if(!['image/png','image/jpeg'].includes(type)){response.resume();request.destroy(invalid('La plantilla remota debe ser PNG o JPEG.'));return;}
      if(Number(response.headers['content-length']||0)>limit){request.destroy(invalid('La plantilla supera 12 MB.'));return;}
      let size=0;const chunks=[];
      response.on('data',chunk=>{size+=chunk.length;if(size>limit)request.destroy(invalid('La plantilla supera 12 MB.'));else chunks.push(chunk);});
      response.on('error',reject);
      response.on('end',()=>resolve(Buffer.concat(chunks)));
    });
    const timeout=setTimeout(()=>request.destroy(invalid('La descarga de la plantilla tardó demasiado.')),10000);
    request.on('close',()=>clearTimeout(timeout));request.on('error',reject);
  });
}
module.exports={isPublicAddress,loadRemoteTemplate};
