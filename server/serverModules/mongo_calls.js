
// =========================================================
// mongoDB requests
// =========================================================

// MongoDB collection reference (will be set by server.js)
let userCol;

// Function to set the collection reference
function setUserCollection(collection) {
    userCol = collection;
}

 async function putDevice_id(deviceId, currentUser) {
    return await userCol.updateOne(
        { userId: currentUser },
        { $set: { deviceId } }
    );
}

async function getDevice_id(currentUser) {
    const user = await userCol.findOne(
        { userId: currentUser },
        { projection: { _id: 0, deviceId: 1 } }
    );
    return user?.deviceId || null;
}


 async function putDocument_BLOCKED(url, currentUser) {
    try {
        const result = await userCol.updateOne(
            { userId: currentUser, blockList: { $ne: url } },
            { $addToSet: { blockList: url } }
        );
        if (result.modifiedCount > 0) {
            console.log(`${url} was submitted!`);
        } else {
            console.log(`${url} already exists`);
        }
    } catch (err) {
        console.error("Insert error:", err);
    }
}

 async function putSessionCount(count, currentUser) {
    try {
        const dateKey = getDateKeySL();

        return await userCol.updateOne(
            { userId: currentUser },
            { $inc: { [`sessionsCompleted.${dateKey}`]: count } }
        );
    } catch (err) {
        console.error(err);
    }
}


 async function removeDocument_BLOCKED(url, currentUser) {
    try {
        const res = await userCol.updateOne(
            { userId: currentUser },
            { $pull: { blockList: url } }
        );
        console.log(`${url} was removed (${res.modifiedCount} modified)`);
    } catch (err) {
        console.error("Delete error:", err);
    }
}

 async function getAll_BLOCKED(currentUser) {
    try {
        const user = await userCol.findOne(
            { userId: currentUser },
            { projection: { _id: 0, blockList: 1 } }
        );
        return user ? user.blockList : [];
    } catch (err) {
        console.error("Fetch error:", err);
        return [];
    }
}

 async function putTotalTime(total_time, day, currentUser) {
    try {
        const res = await userCol.updateOne(
            { userId: currentUser },
            { $set: { [`total_time.${day}`]: parseInt(total_time) } }
        );
        console.log(`Total time for ${day} is saved: ${total_time}`);
    } catch (err) {
        console.error("Insert Error:", err);
    }
}
// Output
/* 
[
  { url: "example.com" },
  { url: "google.com" }
]
*/
 function getDateKeySL() {
    return new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Colombo"
    });
}

// Export all functions
module.exports = {
    putDevice_id,
    getDevice_id,
    putDocument_BLOCKED,
    putSessionCount,
    removeDocument_BLOCKED,
    getAll_BLOCKED,
    putTotalTime,
    getDateKeySL,
    setUserCollection
};
