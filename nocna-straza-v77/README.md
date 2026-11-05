# Noćna Straža v77

Mobilna HTML multiplayer igra, spremna za Cloudflare Workers (Static Assets).

[**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/MajorStex/MajorStex.github.io/tree/main/nocna-straza-v77)

Kada se prikaže Cloudflare čarobnjak, prijavi se u Cloudflare i GitHub (ako se zatraži), proveri da je izabran `nocna-straza-v77` i potvrdi Deploy. Posle uspešnog objavljivanja otvori dodeljenu `*.workers.dev` adresu.

Ovo pravi novi Workers projekat i ne zamenjuje prethodni Cloudflare Pages projekat. Multiplayer koristi postojeću peer/relay mrežnu logiku unutar igre; objavljivanje HTML-a ne postavlja zaseban relay servis.
