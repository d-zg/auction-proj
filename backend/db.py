import os 
from google.cloud import firestore
from google.auth.exceptions import DefaultCredentialsError

# Check if the environment variable is set
if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
    raise RuntimeError(
        "Environment variable `GOOGLE_APPLICATION_CREDENTIALS` is not set. "
        "Please set it to the path of your Google Cloud service account key file.\n\n"
        "Example:\n"
        'export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"\n\n'
        "See https://cloud.google.com/docs/authentication/external/set-up-adc for details."
    )

# Initialize Firestore client
db = firestore.Client()