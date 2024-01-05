import Operable from "../modules/operable.mjs";
import "../modules/persist.mjs";

const a = new Operable();

const b = new Operable(a.id);

a.process.module$.next({ default: () => (input) => input });

a.write.config$.next({ a: 1 });
a.read.config$.subscribe(console.log.bind(console, "A read config"));

b.process.module$.next({ default: () => (input) => input });
b.read.config$.subscribe((config) => console.log("b read config", config));
