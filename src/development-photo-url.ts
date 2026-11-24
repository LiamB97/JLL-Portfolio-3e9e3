const jllPhoto = /^(https:\/\/res\.cloudinary\.com\/jll-global-olm-np\/image\/upload\/)w_\d+,c_limit,q_auto:good,f_auto,fl_progressive\//;

export function sizedDevelopmentPhoto(url: string, width: number) {
  return url.replace(jllPhoto, `$1w_${width},c_limit,q_auto:good,f_jpg/`);
}
