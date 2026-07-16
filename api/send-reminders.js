// This file goes in a folder called /api at the root of your project
// (create /api/send-reminders.js). Vercel automatically turns this into
// a working web address: https://chalk-line.vercel.app/api/send-reminders

const admin = require("firebase-admin");

function getAdminApp() {
  if (admin.apps.length) return admin.apps[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = async function handler(req, res) {
  // Simple protection so random people on the internet can't trigger this
  const secret = req.query.secret || req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    getAdminApp();
    const db = admin.firestore();
    const messaging = admin.messaging();

    const snapshot = await db.collection("planners").get();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let notificationsSent = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const tasks = data.tasks || [];
      const deviceTokens = data.deviceTokens || [];
      const remindersSent = data.remindersSent || [];

      if (deviceTokens.length === 0) continue;

      const dueNowTasks = tasks.filter((t) => {
        if (t.done || !t.dueDate) return false;
        if (remindersSent.includes(t.id)) return false;
        const due = new Date(t.dueDate + "T00:00:00");
        return due <= today; // due today or overdue, not yet notified
      });

      if (dueNowTasks.length === 0) continue;

      const newlyNotifiedIds = [];

      for (const task of dueNowTasks) {
        const message = {
          notification: {
            title: "Assignment due",
            body: `"${task.title}" is due${task.course ? " for " + task.course : ""}.`,
          },
          tokens: deviceTokens,
        };

        try {
          await messaging.sendEachForMulticast(message);
          notificationsSent++;
          newlyNotifiedIds.push(task.id);
        } catch (err) {
          console.error("Failed to send for task", task.id, err);
        }
      }

      if (newlyNotifiedIds.length > 0) {
        await docSnap.ref.update({
          remindersSent: admin.firestore.FieldValue.arrayUnion(...newlyNotifiedIds),
        });
      }
    }

    res.status(200).json({ ok: true, notificationsSent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
