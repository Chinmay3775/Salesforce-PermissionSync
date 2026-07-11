import json
import urllib.request
import urllib.parse

def main():
    with open('creds.json') as f:
        creds = json.load(f)
        
    for env in ["DEV", "UAT"]:
        data = {
            "environment": env,
            "client_id": creds[env]["client_id"],
            "client_secret": creds[env]["client_secret"],
            "org_url": creds[env]["org_url"]
        }
        
        req = urllib.request.Request(
            'http://127.0.0.1:8000/api/connect-org',
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        try:
            with urllib.request.urlopen(req) as response:
                print(f"Connected {env}: {response.status}")
                print(response.read().decode())
        except Exception as e:
            print(f"Failed to connect {env}: {e}")

if __name__ == '__main__':
    main()
