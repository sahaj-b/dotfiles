from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import pickle
import os.path

# If modifying these scopes, delete the file token.pickle.
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


def get_current_event(calendar_id):
    creds = None
    if os.path.exists("/home/sahaj/token.pickle"):
        with open("/home/sahaj/token.pickle", "rb") as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "/home/sahaj/credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
        with open("/home/sahaj/token.pickle", "wb") as token:
            pickle.dump(creds, token)

    service = build("calendar", "v3", credentials=creds)
    now = datetime.utcnow()
    maxtime = (now + timedelta(minutes=1)).isoformat() + "Z"
    events_result = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=now.isoformat() + "Z",
            timeMax=maxtime,
            maxResults=1,  # increase if more than one current event
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    events = events_result.get("items", [])
    return events


def display_current_events():
    blue = "#74c7ec"
    calendars = [
        "primary",
        "34624bc46c7437a816658294c1682e1c5de1717e4a2693e15f2af4203a4b7b0c@group.calendar.google.com",
        "0fb1c9c7105249bf1a66a20120c9184cd7a1d51d79fd3411c6c0917fa5eb3864@group.calendar.google.com",
        "family14964246631284460147@group.calendar.google.com",
    ]

    for calendar_id in calendars:
        current_event = get_current_event(calendar_id)
        if current_event:
            start_time = current_event[0]["start"].get(
                "dateTime", current_event[0]["start"].get("date")
            )
            end_time = current_event[0]["end"].get(
                "dateTime", current_event[0]["end"].get("date")
            )

            # Extract timezone offset and create datetime objects
            start_time = datetime.fromisoformat(start_time[:-6])
            end_time = datetime.fromisoformat(end_time[:-6])

            # Convert to local timezone
            local_timezone = start_time.astimezone().tzinfo
            start_time = start_time.astimezone(local_timezone).strftime("%I:%M")
            end_time = end_time.astimezone(local_timezone).strftime("%I:%M")

            summary = current_event[0]["summary"]
            print(f"󰃰 {summary} [{start_time}-{end_time}]")
            return  # remove if more than one event
    print("󰃰 Nothing to do rn")


display_current_events()
