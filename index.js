// import FilesReader and SkillsWriter classes from skills-kit-2.0.js library
const { FilesReader, SkillsWriter } = require('skills-kit-2.0');
const clarifai = require('clarifai');
const fs = require('fs');
const configFile = JSON.parse(fs.readFileSync("config.json"));

// Instantiate a new Clarifai app instance
const app = new clarifai.App({
  apiKey: configFile.clarifaiKey
});

let clarifaiThis = async (event, context, callback) => {
    // Set Up Environment
    console.log(JSON.stringify(event)); // Since we're using Serverless, this event would be recorded in CloudWatch. The event can then be used to manually trigger Lambda in the AWS Management console.
    let respBody = JSON.parse(event.body); // Parse response body
    let readToken = respBody.token.read.access_token;

    // create new FilesReader object and retrieve fileContext.
    let filesReader = new FilesReader(event.body);
    let fileContext = filesReader.getFileContext();
    console.log("File Context: " + JSON.stringify(fileContext)); // Double check values in CloudWatch to make sure context is properly created

    // Define inputs
    let fileId = fileContext.fileId;

    console.debug(`Box event received with file ID ${fileId}`);

    // create new SkillsWriter object and tell Box that processing is in flight
    const skillsWriter = new SkillsWriter(fileContext);
    skillsWriter.saveProcessingCard();

    // Begin sending file to Clarifai
    try {

      // Send picture to clarifai
      let response = await app.models.predict(clarifai.GENERAL_MODEL, fileContext.fileDownloadURL);

      // Push the resultant categories into an array
      let entries = [];
      for (let category of response.outputs[0].data.concepts) {
        if (category.value > 0.9) {
          entries.push({ type: 'text', text: category.name });
        }
      }

      // Create and save topics card with entries
      let topicJSON = await skillsWriter.createTopicsCard(entries);
      skillsWriter.saveDataCards([topicJSON]);

    } catch (e) {

      // This error will go to CloudWatch
      console.error(`Skill processing failed for file: ${fileContext.fileId} with error: ${error}`);

      // Let Box know that an error occurred
      skillsWriter.saveErrorStatusCard(skillsWriter.error.FILE_PROCESSING_ERROR);

    } finally {
      callback(null, { statusCode: 200, body: 'Box event was processed by skill' });
    }
};

module.exports = {clarifaiThis};
