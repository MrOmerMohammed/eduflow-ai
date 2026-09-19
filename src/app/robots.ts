import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { const base=process.env.NEXT_PUBLIC_APP_URL||"https://eduflow-ai-wzks.onrender.com"; return {rules:{userAgent:"*",allow:["/","/pricing","/privacy","/terms","/security"],disallow:["/api/","/app/"]},sitemap:base+"/sitemap.xml"}; }
