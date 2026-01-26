>[!IMPORTANT]
>**Work-in-progress** - Firefli is currently in the process of updating this read me and creating our documentation for Firefli. We recommend you host for free with our online platform, however you can still self-host by following our <a href="https://docs.firefli.net">Documentation</a>. Expect bugs in this beta. We've tried our best to iron out everything we could find in Tovy and Orbit, but we expect there to be issues. Let us know by creating an issue, or if you're adventurous... patch it yourself and send in a PR.

>[!TIP]
> The best and easiest way to get started with Firefli is our cloud hosting solution. It's easy, secure, and superfast. See https://firefli.net to get started. The best part? It's **FREE**!
<div>
  <div align="left">
    <img height="40px" src=".github/logo.png"></img>
    <h1>Firefli by Cloudysatrn (Main Orbit Maintainer)</h1>
  </div>
    <img src="https://img.shields.io/badge/version-v1.0.1-purple"></img>
  <ul>
    <li><a href="#about">About</a></li>
    <li><a href="#why-consider">Why consider</a></li>
    <li><a href="#quicklinks">Quicklinks</a></li>
    <li><a href="#license">License</a></li>
  </ul>

  <h2>About</h2>
  <p>
    Firefli is a modern, improved, and maintained fork of the open source staff management platform, Orbit. It allows Roblox groups to manage their group members in a more intuitive and powerful way, while still being simple to use. Firefli aims to continue the original Tovy and Orbit mission and maintain, improve, and introduce new features to Firefli. So far, we've fixed critical bugs that essentially bricked Tovy and Orbit, improved the UI, and introduced image support to the wall. We also created our own custom runtime and cloud hosting service to bring Firefli to the masses for free, in just a few clicks.
  </p>
  <h2>Why consider</h2>
  <p>
    Firefli is the same much loved Orbit concept but with a sleek new design.
	You'll feel right at home with the same cosy and simple to use UI.
  </p>
  <ul>
    <li>
      Beautifully-crafted and responsive frontend
    </li>
    <li>
      Packed with a lot of features, such as...
      <ul>
        <li>
          Creating custom roles and invite users or sync it to your group
        </li>
        <li>
          Bulk manage your group members
        </li>
        <li>
          Track your members' group activity
        </li>
        <li>
          Rank with Firefli Intergrations
        </li>
        <li>
          Warn, promote, demote, and way more to your members
        </li>
        <li>
          Communicate with your members directly in Firefli
        </li>
        <li>
          Host your docs with Firefli
        </li>
        <li>
          Assign your staff activity requirements
        </li>
        <li>
          Track when your members are inactive with notices
        </li>
        <li>
          Create and assign Policies for members to sign
        </li>
        <li>
          Host & Schedule sessions without causing a burden
        </li>
      </ul>
    </li>
    <li>
      Frontend written in TS with Nextjs & TailwindCSS, backend written in Typescript & Next.js
    </li>
    <li>
      Completely open source
    </li>
  </ul>

  <h2>Quicklinks</h2>
  <ul>
    <li>
      Don't know how to install? –– <a href="https://docs.firefli.net">Visit our documentation!</a>
    </li>
    <li>
      🐛 Bugs? Have ideas? –– <a href="https://feedback.firefli.net/bugs">Get support and let us know here!</a>
    </li>
    <li>
      ✨ Updates –– <a href="https://feedback.firefli.net/changelog">View our Features and updates!</a>
    </li>
  </ul>

  <p><strong>Required environment variables:</strong></p>
  <ul>
    <li><code>SESSION_SECRET</code> – A strong secret string (e.g. generated via <code>openssl rand -base64 32</code>)</li>
    <li><code>DATABASE_URL</code> – Your connection string (e.g. hosted on Supabase, Railway, Neon, etc.)</li>
    <li><code>NEXTAUTH_URL</code> – Your Domain/Connection URL (e.g. https://domain.domain.com - no / at end.)</li>
  </ul>
  <p><strong>Optional environment variables:</strong></p>
  <ul>
    <li><code>ROBLOX_CLIENT_ID</code> – Roblox oAuth ID (e.g. 1312974419555602493</code>)</li>
    <li><code>ROBLOX_CLIENT_SECRET</code> – Your client secret (e.g. RBX-GLEmbz3yrU...)</li>
    <li><code>ROBLOX_REDIRECT_URI</code> – Your Domain Callback URI (e.g. https://domain.domain.com/api/auth/roblox/callback .)</li>
    <li><code>ROBLOX_OAUTH_ONLY</code> – Force oAuth as only login method (e.g. true/false)</li>
  </ul>

  <h2>License</h2>
  Firefli is licensed under the <a href="./LICENSE">GNU General Public License v3.0.</a>
</div>
