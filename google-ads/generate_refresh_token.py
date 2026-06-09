#!/usr/bin/env python3
"""Generate the OAuth refresh token needed in google-ads.yaml.

Run this once on your own computer (it opens a browser for Google sign-in):

    python generate_refresh_token.py --client-id XXXX --client-secret YYYY

Sign in with the Google account that has access to your Google Ads account,
then copy the printed refresh token into google-ads.yaml.
"""

import argparse

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/adwords"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client-id", required=True, help="OAuth client ID")
    parser.add_argument("--client-secret", required=True, help="OAuth client secret")
    args = parser.parse_args()

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": args.client_id,
                "client_secret": args.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
    )
    credentials = flow.run_local_server(port=8080, open_browser=True)

    print("\nAdd these to google-ads.yaml:")
    print(f"  client_id: {args.client_id}")
    print(f"  client_secret: {args.client_secret}")
    print(f"  refresh_token: {credentials.refresh_token}")


if __name__ == "__main__":
    main()
