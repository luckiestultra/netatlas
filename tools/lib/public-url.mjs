export function publicArtifactUrl(baseUrl, client, path) {
  if(!baseUrl)return null;
  const normalized=String(baseUrl).replace(/\/+$/,'');
  const url=new URL(normalized);
  if(!['http:','https:'].includes(url.protocol)||url.search||url.hash||url.username||url.password||/[,\s]/.test(normalized))throw new Error('Feature baseUrl must be an HTTP(S) directory without credentials, query, fragment or configuration delimiters');
  if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(client)||! /^[a-z-]+\/[a-z0-9.-]+$/.test(path))throw new Error('Invalid public artifact path');
  return normalized+'/clients/'+client+'/'+path;
}
