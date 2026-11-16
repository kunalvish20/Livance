# Livance setup — Simple Hindi guide

1. **Supabase project** banao. `SQL Editor` mein pehle `sql/001_schema.sql` run karo.
2. Supabase `Authentication > Users > Add user` mein apna real admin email + **naya strong private password** add karo.
3. `sql/002_make_admin.sql` run karo. Isme admin email check karo. Query ka result `admin` hona chahiye.
4. `sql/003_live_bridge.sql` run karo — ye exact UI se connected live data, leads, requests aur email logs ki tables banata hai.
5. Project ki `.env.example` ki copy `.env` naam se banao, aur Supabase URL + publishable/anon keys paste karo.
6. Real email ke liye **Resend** account par apna sending domain verify karke `RESEND_API_KEY`, `EMAIL_FROM` aur `NOTIFY_EMAIL` bhi `.env` mein bharo.
7. Terminal mein:

```powershell
npm install
npm run check
npm run dev
```

Customer website `http://localhost:5173/` aur admin `http://localhost:5173/admin` par khulega. API status `http://localhost:3001/api/v2/health` pe check karo.

**Important:** Supabase/Resend keys na hone par sirf UI preview chalega. Real email bhejne ke liye provider verification necessary hai. Real payment aur Zoho Books abhi connected **nahin** hain; payment screen booking request save karti hai, charge nahin. Full technical limitations `README.md` mein hain.

**Live deploy:** Vercel par repo upload karo, framework Vite select karo. `.env` wale variables Vercel `Project Settings > Environment Variables` mein add karo, `CLIENT_ORIGIN` aur `PUBLIC_SITE_URL` ko Vercel domain rakho. Supabase Auth URL Configuration mein Vercel domain allow karo. Har test khud live check karo before publicly opening.
