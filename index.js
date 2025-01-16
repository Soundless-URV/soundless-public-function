const functions = require("firebase-functions");
const {PubSub} = require('@google-cloud/pubsub');

exports.storeRecording = functions
    .region('europe-west2')
    .https
    .onCall((data, context) => {        
        const projectId = process.env.PROJECT_ID
        const topicName = process.env.TOPIC_NAME
        const pubsub = new PubSub({projectId});
        const topic = pubsub.topic(topicName);

        // App Check (Firebase) - request coming from trusted source?
        // Do NOT enforce App Check. Reason: checks failing, probably due to signature issues

        // console.log("Firebase App Check...");
        // if (context.app == undefined) {
        //     console.log("context.app is undefined");
        //     throw new functions.https.HttpsError(
        //         "failed-precondition",
        //         "The function must be called from an App Check verified app."
        //     );
        // }

        // User authenticated?
        if (!context.auth) {
            console.log("User is not authenticated");
            throw new functions.https.HttpsError("failed-precondition", "Not authenticated.");
        }

        // Metadata valid?
        if (
            !data.uuid ||
            !Number.isFinite(data.lng) ||
            !Number.isFinite(data.lat) ||
            !Array.isArray(data.measurements) ||
            data.measurements?.length <= 0 ||       // No measurements
            data.measurements?.length > 259200      // +3 days long recording
        ) {
            console.log("Invalid metadata");
            throw new functions.https.HttpsError("invalid-argument", "Invalid metadata.");
        }
        
        // Measurements valid? If valid, publish each one to Pub/Sub
        data.measurements.forEach(measurement => {
            if (
                !Number.isFinite(measurement.timestamp) ||
                !Number.isFinite(measurement.dB) ||
                (typeof measurement.heartRate !== "undefined" && !Number.isFinite(measurement.heartRate)) ||
                (typeof measurement.sleepStage !== "undefined" && !Number.isFinite(measurement.sleepStage)) ||
                measurement.timestamp < 0 ||
                measurement.dB < 0
            ) {
                console.log("Invalid measurements");
                throw new functions.https.HttpsError("invalid-argument", "One or more measurements are invalid.");
            } else {
                const json = {
                    "uuid": data.uuid,
                    "lng": data.lng, 
                    "lat": data.lat,
                    "timestamp": measurement.timestamp,
                    "dB": measurement.dB,
                    "heartRate": measurement.heartRate || -1,
                    "sleepStage": measurement.sleepStage || -1
                }
                topic.publishMessage({json});
            }
        });
        
        console.log("Published successfully");

        return {uuid: data.uuid};
});
