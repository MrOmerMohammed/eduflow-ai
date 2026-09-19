import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { const base=process.env.NEXT_PUBLIC_APP_URL||"https://eduflow-ai-wzks.onrender.com"; return ["/","/pricing","/privacy","/terms","/security","/auth/login","/auth/sign-up"].map(path=>({url:base+path,lastModified:new Date()})); }
