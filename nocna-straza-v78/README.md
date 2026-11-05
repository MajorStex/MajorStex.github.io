# Noćna Straža v78 — low-latency multiplayer

Testirana mobilna HTML igra sa prilagođenim brzim snapshot-ovima i ispravljenim glađenjem kretanja gostiju.

[**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FMajorStex%2FMajorStex.github.io%2Ftree%2Fmain%2Fnocna-straza-v78)

Jedan klik otvara Cloudflare postupak: prijava u nalog, potvrda kreiranja novog Workers projekta, pokretanje i objava javne `*.workers.dev` adrese. Cloudflare **neće automatski zameniti** postojeći Pages sajt.

**Svi igrači moraju da koriste v78 i naprave novu sobu.** WebSocket relay na `nocna-straza-relay.stefanstevic1996.workers.dev` je postojeći zaseban servis i ovim deploy-em se ne menja. Ako je taj relay nedostupan, multiplayer neće moći da radi, čak ni ako se HTML uspešno objavi.

Verifikacija: 4/4 JS blokova prolaze `node --check`; testovi 1 host + 2 gosta i 1 host + 5 gostiju, chat, simulirani gubitak snimaka i ponovno pokretanje runde prošli bez browser runtime grešaka. Stvarni javni relay i fizički telefoni nisu testirani.
