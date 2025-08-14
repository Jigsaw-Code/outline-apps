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
	"github.com/Jigsaw-Code/outline-sdk/transport"
)

var CookieFilePath string

func SetCookieFilePath(path string) {
	CookieFilePath = path + "/cookies.json"
}

func Report(ur *config.UsageReporter) (err error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("failed to create cookie jar: %w", err)
	}
	var urls []*url.URL
	// Load cookies from file
	urls, err = loadCookies(jar, CookieFilePath)
	if err != nil {
		return fmt.Errorf("failed to load cookies: %w", err)
	}

	u, err := url.Parse(ur.Url)
	if err != nil {
		return fmt.Errorf("failed to parse URL: %w", err)
	}

	allCookies := jar.Cookies(u)
	var cookies []*http.Cookie
	for _, c := range allCookies {
		if c.Name == ur.KeyId {
			c.Name = "client_id" // Reporting server is not supposed to know the Key ID
			cookies = append(cookies, c)
		}
	}
	// Create a context with a timeout to avoid indefinite hangs.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Create an HTTP client with the cookie jar
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Prepare the HTTP POST request with cookies and a sample body.
	requestBody := strings.NewReader("param1=value1&param2=value2")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ur.Url, requestBody)
	if err != nil {
		return fmt.Errorf("failed to create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Connection", "close")

	// Add cookies to the request.
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	slog.Info("HTTP Request", "Method", req.Method, "URL", req.URL, "Headers", req.Header, "Cookies", req.Cookies())
	// Send the HTTP request.
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send HTTP request: %w", err)
	}
	defer resp.Body.Close()

	// Read the response body (not used, but required to complete the request).
	_, err = io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	// Extract new cookies from the response.
	newCookies := resp.Cookies()
	if len(newCookies) > 0 {
		// Rebuild newCookies with correct Domain and Path
		var cookies []*http.Cookie
		for _, c := range newCookies {
			c.Name = ur.KeyId // Replacing the string "client_id" with the Key ID as the cookie name
			cookies = append(cookies, c)
		}

		// Check if the URL is already in the list
		jar.SetCookies(u, cookies)
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
		// Save new cookies to file
		if err := saveCookies(urls, jar, CookieFilePath); err != nil {
			return fmt.Errorf("failed to save cookies: %w", err)
		}
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

// RemoveCookiesByKeyID removes cookies with the specified KeyID from the cookie file.
// If keyID is empty, all cookies will be removed.
func RemoveCookiesByKeyID(keyID string) error {
	file, err := os.Open(CookieFilePath)
	if err != nil {
		return fmt.Errorf("failed to open cookies file: %w", err)
	}
	defer file.Close()

	var cookieDataMap map[string][]CookieDetail
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&cookieDataMap); err != nil {
		return fmt.Errorf("failed to decode cookies: %w", err)
	}

	// Filter out cookies with matching KeyID
	for urlStr, cookieDetails := range cookieDataMap {
		var filteredCookies []CookieDetail
		for _, c := range cookieDetails {
			if c.Name != keyID && keyID != "" {
				filteredCookies = append(filteredCookies, c)
			}
		}
		cookieDataMap[urlStr] = filteredCookies
	}

	// Save the updated cookies back to the file
	file, err = os.Create(CookieFilePath)
	if err != nil {
		return fmt.Errorf("failed to create cookies file: %w", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	if err := encoder.Encode(cookieDataMap); err != nil {
		return fmt.Errorf("failed to encode cookies: %w", err)
	}

	slog.Info("Cookies removed successfully.")
	return nil
}

// StartReporting calls the Report function at every interval.
func StartReporting(ctx context.Context, tcp transport.StreamDialer, ur *config.UsageReporter) {
	slog.Info("StartReporting started...")
	if !ur.EnableCookies {
		return
	}
	ticker := time.NewTicker(ur.Interval)
	defer ticker.Stop()

	err := Report(ur)
	if err != nil {
		slog.Warn("Report failed", "error", err)
	}
	for {
		select {
		case <-ticker.C:
			err := Report(ur)
			if err != nil {
				slog.Warn("Report failed", "error", err)
			}
		case <-ctx.Done():
			// Stop reporting when the context is canceled
			slog.Info("Stopping reporting...")
			return
		}
	}
}
