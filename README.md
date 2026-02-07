
# FITDEX — Find Your Gym, Bring Your Duo

Welcome to FitDex — the easiest way to discover gyms, join with a friend, and unlock exclusive duo discounts in Delhi NCR. Whether you're a fitness enthusiast or a gym owner, FitDex makes memberships, payments, and partnerships effortless.



## Why FitDex?

- 🗺️ **Find Gyms Near You:** Instantly browse gyms on a map, see real prices, and check reviews.
- 👥 **Bring a Friend, Save More:** Invite a partner and both get duo discounts on memberships.
- 💳 **Easy Online Payments:** Pay securely online—no cash, no hassle.
- 📊 **Track Your Progress:** Members get a dashboard to view their memberships, payments, and duo status.
- 🏋️ **For Gym Owners:** List your gym, manage members, offer discounts, and see analytics—all in one place.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, ShadCN/UI, Framer Motion
- **Backend**: Next.js API routes, Prisma ORM, SQLite
- **Auth**: NextAuth (Email + Google OAuth)
- **Payments**: Razorpay Checkout
- **Maps**: OpenStreetMap (Leaflet + Nominatim)


## How It Works

1. **Explore Gyms:** Open FitDex and browse gyms on the map. Filter by location, price, or features.
2. **Register & Login:** Create your account in seconds—use email or Google.
3. **Invite a Friend:** Want a duo discount? Invite your workout partner to join the same gym.
4. **Pay Online:** Choose your plan and pay securely. Both you and your duo get instant access.
5. **Track Everything:** See your active memberships, duo status, and payment history in your dashboard.

**For Gym Owners:**
- List your gym for free and reach more members.
- Manage memberships, offer discounts, and track revenue with your own dashboard.


## FAQ

**Q: Do I need a partner to join?**
A: No! You can join solo, but bringing a friend unlocks extra discounts.

**Q: How do I pay?**
A: All payments are online and secure. No cash needed.

**Q: What if my friend joins later?**
A: You can invite them anytime. Once they join, your duo discount activates automatically.

**Q: I'm a gym owner. How do I list my gym?**
A: Click "List Your Gym" on the site, register as an owner, and follow the steps.



## Support

Need help? Have feedback? Reach out via the contact form on the website or email support@fitdex.com.

## Environment Variables

See `.env.example` for all required variables. Key ones:

- `DATABASE_URL` — SQLite database path
- `NEXTAUTH_SECRET` — NextAuth secret
- `NEXTAUTH_URL` — App URL
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Razorpay keys



---

## License

Private — All rights reserved

