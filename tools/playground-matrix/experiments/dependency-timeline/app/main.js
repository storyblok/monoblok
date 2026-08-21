import { load as loadA } from "sdk-a";
import { load as loadB } from "sdk-b";
import { load as loadC } from "sdk-c";

async function probe() {
  const instances = await Promise.all([loadA({}), loadB({}), loadC({})]);
  const classes = [];

  for (const instance of instances) {
    if (!classes.includes(instance.constructor)) classes.push(instance.constructor);
  }

  return classes.length;
}

probe().then((count) => {
  window.__demo = { distinctClasses: count };
  document.querySelector("#app").textContent = `distinct bridge classes: ${count}`;
});
