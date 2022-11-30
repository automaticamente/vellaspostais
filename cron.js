import Bree from "bree";

const cron = new Bree({
  jobs: [
    {
      name: "bot",
      interval: "at 12:00 also at 22:00",
    },
  ],
});

(async function () {
  await cron.start();
})();
