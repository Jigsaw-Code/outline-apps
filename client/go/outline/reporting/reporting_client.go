/**
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package reporting

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"strings"
	"time"

	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"

	"github.com/Jigsaw-Code/outline-apps/client/go/outline/config"
	"github.com/Jigsaw-Code/outline-apps/client/go/outline/connectivity"
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

func checkTCPConnectivity(tcp transport.StreamDialer, reportingUrl string) error {
	return connectivity.CheckTCPConnectivityWithHTTP(tcp, reportingUrl)
}

const cookiesFile = "cookies.json"

func Report(tcp transport.StreamDialer, reportingUrl string) (err error) {
	// Perform a TCP connectivity check.
	if err := checkTCPConnectivity(tcp, reportingUrl); err != nil {
		return fmt.Errorf("TCP connectivity check failed: %w", err)
	}

	// Load cookies from file
	jar, err := cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("failed to create cookie jar: %w", err)
	}
	var urls []*url.URL
	urls, err = loadCookies(jar, cookiesFile)
	if err != nil {
		return fmt.Errorf("failed to load cookies: %w", err)
	}

	u, err := url.Parse(reportingUrl)
	if err != nil {
		return fmt.Errorf("failed to parse URL: %w", err)
	}
	cookies := jar.Cookies(u)

	// Create a context with a timeout to avoid indefinite hangs.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Dial the stream using the StreamDialer.
	conn, err := tcp.DialStream(ctx, reportingUrl)
	if err != nil {
		return fmt.Errorf("failed to connect to %s: %w", reportingUrl, err)
	}
	defer conn.Close()

	// Create an HTTP POST request with cookies and a sample body
	requestBody := "param1=value1&param2=value2"
	request := "POST / HTTP/1.1\r\n" +
		"Host: " + strings.TrimPrefix(reportingUrl, "https://") + "\r\n" +
		"Content-Type: application/x-www-form-urlencoded\r\n" +
		"Content-Length: " + fmt.Sprintf("%d", len(requestBody)) + "\r\n" +
		"Connection: close\r\n"

	for _, cookie := range cookies {
		request += fmt.Sprintf("Cookie: %s=%s\r\n", cookie.Name, cookie.Value)
	}
	request += "\r\n" + requestBody

	_, err = conn.Write([]byte(request))
	if err != nil {
		return fmt.Errorf("failed to write request: %w", err)
	}

	// Read the response from the server.
	var response []byte
	buffer := make([]byte, 4096)
	for {
		n, err := conn.Read(buffer)
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("failed to read response: %w", err)
		}
		response = append(response, buffer[:n]...)
	}

	// Parse the HTTP response to extract cookies.
	headersEnd := bytes.Index(response, []byte("\r\n\r\n"))
	if headersEnd == -1 {
		return fmt.Errorf("failed to find end of headers in response")
	}

	headers := string(response[:headersEnd])

	// Extract cookies from the headers.
	var newCookies []*http.Cookie
	lines := strings.Split(headers, "\r\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "Set-Cookie:") {
			cookie := strings.TrimPrefix(line, "Set-Cookie: ")
			parts := strings.SplitN(cookie, ";", 2)
			if len(parts) > 0 {
				cookieParts := strings.SplitN(parts[0], "=", 2)
				if len(cookieParts) == 2 {
					newCookies = append(newCookies, &http.Cookie{
						Name:  cookieParts[0],
						Value: cookieParts[1],
					})
					fmt.Println("Cookie found:", cookie)
				}
			}
		}
	}
	// Check if the URL is already in the list
	exists := false
	for _, existingURL := range urls {
		if existingURL.String() == u.String() {
			exists = true
			break
		}
	}
	if !exists {
		urls = append(urls, u)
	}
	jar.SetCookies(u, newCookies)
	// Save new cookies to file
	if err := saveCookies(urls, jar, cookiesFile); err != nil {
		return fmt.Errorf("failed to save cookies: %w", err)
	}

	return nil
}

// CookieData represents the structure for saving cookies, including the URL
type CookieData struct {
	URL     string         `json:"url"`
	Cookies []CookieDetail `json:"cookies"`
}

type CookieDetail struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Domain string `json:"domain"`
	Path   string `json:"path"`
}

func saveCookies(urls []*url.URL, jar http.CookieJar, filename string) error {
	// Retrieve all cookies from the jar
	cookieDataMap := make(map[string][]CookieDetail)

	for _, urlObj := range urls {
		cookies := jar.Cookies(urlObj)
		var cookieDetails []CookieDetail
		for _, cookie := range cookies {
			cookieDetails = append(cookieDetails, CookieDetail{
				Name:   cookie.Name,
				Value:  cookie.Value,
				Domain: cookie.Domain,
				Path:   cookie.Path,
			})
		}

		cookieDataMap[urlObj.String()] = cookieDetails
	}

	// Save the cookies data to a file
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	if err := encoder.Encode(cookieDataMap); err != nil {
		return err
	}

	return nil
}

func loadCookies(jar http.CookieJar, filename string) ([]*url.URL, error) {
	// Read cookies from the file
	file, err := os.Open(filename)
	if errors.Is(err, fs.ErrNotExist) {
		return []*url.URL{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var cookieDataMap map[string][]CookieDetail
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&cookieDataMap); err != nil {
		return nil, err
	}

	var urls []*url.URL
	// Convert the loaded data back into http.Cookie objects and load them into the jar
	for urlStr, cookieDetails := range cookieDataMap {
		parsedURL, err := url.Parse(urlStr)
		if err != nil {
			return nil, err
		}

		var cookies []*http.Cookie
		for _, c := range cookieDetails {
			cookies = append(cookies, &http.Cookie{
				Name:   c.Name,
				Value:  c.Value,
				Domain: c.Domain,
				Path:   c.Path,
			})
		}

		// Set the cookies in the jar for the specified URL
		jar.SetCookies(parsedURL, cookies)
		urls = append(urls, parsedURL)
	}

	return urls, nil
}

// StartReporting calls the Report function at every internal.
func StartReporting(ctx context.Context, tcp transport.StreamDialer, ur *config.UsageReporter) {
	if !ur.EnableCookies {
		return
	}
	ticker := time.NewTicker(ur.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			err := Report(tcp, ur.Url)
			if err != nil {
				slog.Error("Report failed", "error", err)
			}
		case <-ctx.Done():
			// Stop reporting when the context is canceled
			slog.Info("Stopping reporting...")
			return
		}
	}
}
