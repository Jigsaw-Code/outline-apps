import http.server
import socketserver
import uuid
from http.cookies import SimpleCookie

PORT = 8080

class CollectorHandler(http.server.BaseHTTPRequestHandler):
    """
    A specific HTTP request handler that only accepts POST requests to /report,
    and sets a user_id cookie if one is not present.
    """
    def do_POST(self):
        # Check if the path is correct
        if self.path != '/report':
            self.send_error(404, "Not Found: Please post to /report")
            return

        # Check for the user_id cookie in the request headers
        cookie_header = self.headers.get('Cookie')
        request_cookies = SimpleCookie()
        if cookie_header:
            request_cookies.load(cookie_header)

        user_id_morsel = request_cookies.get('user_id')
        new_cookie_to_set = None

        if not user_id_morsel:
            # If cookie is missing, generate a new user_id and prepare the Set-Cookie header
            new_user_id = str(uuid.uuid4())
            response_cookies = SimpleCookie()
            response_cookies['user_id'] = new_user_id
            response_cookies['user_id']['path'] = '/'
            response_cookies['user_id']['max-age'] = 31536000  # 1 year
            response_cookies['user_id']['samesite'] = 'Lax'
            new_cookie_to_set = response_cookies.output(header='', sep='').strip()
            print(f"-> No 'user_id' cookie found. Setting new one: {new_user_id}")
        else:
            print(f"-> Found existing 'user_id' cookie: {user_id_morsel.value}")

        # Log the request details
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        print("--- NEW POST REQUEST TO /report ---")
        print("Headers:")
        print(self.headers)
        print("Body:")
        try:
            print(post_data.decode('utf-8'))
        except UnicodeDecodeError:
            print(post_data)
        print("--- END REQUEST ---\n")

        # Send the response
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        
        # Add the Set-Cookie header to the response if we created one
        if new_cookie_to_set:
            self.send_header('Set-Cookie', new_cookie_to_set)
        
        self.end_headers()
        self.wfile.write(b'{"status": "ok"}')

    def do_GET(self):
        # Handle incorrect method (GET)
        if self.path == '/report':
            self.send_error(405, "Method Not Allowed: Please use POST")
        else:
            self.send_error(404, "Not Found")

# --- Main execution ---
if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), CollectorHandler) as httpd:
        print(f"Serving dummy collector on port {PORT}")
        print(f"Ready to receive POST requests at http://localhost:{PORT}/report")
        httpd.serve_forever()
