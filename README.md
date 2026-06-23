<img width="1918" height="927" alt="Screenshot 2026-06-23 115953" src="https://github.com/user-attachments/assets/a9adb675-f05f-437a-bf92-5ad3e7cef257" />
<img width="1915" height="906" alt="Screenshot 2026-06-23 115825" src="https://github.com/user-attachments/assets/d396929d-01ce-4079-9349-8d241b69f37f" />
<img width="1907" height="912" alt="Screenshot 2026-06-23 115737" src="https://github.com/user-attachments/assets/4eb661d3-f8f5-4efb-a9ab-88a54c866c4e" />
# AI Image Forensics Analyzer

A hybrid digital image authenticity verification platform that combines deep learning and forensic analysis to determine whether an image is authentic or AI-generated.

## Overview

AI Image Forensics Analyzer is designed to assist digital investigators, journalists, cybersecurity professionals, and researchers in assessing image authenticity through multiple forensic techniques.

The platform combines:

* CNN-based image classification
* Metadata (EXIF) analysis
* Error Level Analysis (ELA)
* Noise pattern analysis
* Authenticity scoring engine
* Automated forensic reporting

---

## Features

### CNN Analysis

Uses a deep learning model to analyze image characteristics and classify images as authentic or AI-generated.

### Metadata Analysis

Extracts and analyzes EXIF metadata including:

* Camera model
* Device information
* Capture timestamp
* Software signatures

### Error Level Analysis (ELA)

Highlights compression inconsistencies that may indicate manipulation.

### Noise Pattern Analysis

Examines image noise characteristics to detect synthetic image artifacts.

### Authenticity Scoring

Combines results from multiple forensic modules into a unified authenticity score.

### Forensic Report Generation

Produces a detailed forensic assessment report for each analyzed image.

---

## Technology Stack

### Backend

* Python
* Flask

### Computer Vision

* TensorFlow / Keras
* OpenCV
* Pillow

### Frontend

* HTML
* CSS
* JavaScript

### Forensic Modules

* EXIF Analysis
* Error Level Analysis
* Noise Analysis
* CNN Classification

---

## Project Structure

```text
AI-Image-Forensics-Analyzer/
│
├── app.py
├── model/
│   └── ai_detector_v3.keras
│
├── forensic/
│   ├── cnn.py
│   ├── exif.py
│   ├── ela.py
│   ├── noise.py
│   ├── scoring.py
│   └── report.py
│
├── static/
│   ├── style.css
│   └── app.js
│
├── templates/
│   └── index.html
│
├── uploads/
│
└── README.md
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/ai-image-forensics-analyzer.git
cd ai-image-forensics-analyzer
```

Create virtual environment:

```bash
python -m venv venv
```

Activate environment:

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run application:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

---

## Workflow

1. Upload image
2. CNN analyzes image content
3. EXIF metadata is extracted
4. ELA analysis is performed
5. Noise patterns are examined
6. Authenticity score is calculated
7. Final forensic report is generated

---

## Example Output

```text
Authenticity Report

Overall Assessment : Likely Authentic

Authenticity Score : 68/100

CNN Prediction : Real Image

Metadata : Present

ELA Risk : Low

Noise Risk : High
```

---

## Future Improvements

* Larger forensic datasets
* Better AI-generated image detection
* Support for multiple generative models
* Explainable AI visualizations
* PDF forensic report export
* REST API support
* Real-time image verification

---

## Use Cases

* Digital Forensics
* Cybersecurity Investigations
* Media Verification
* Deepfake Detection
* Journalism Fact Checking
* Academic Research

---

## Disclaimer

This tool provides forensic indicators and authenticity estimates. Results should be used as supporting evidence and not as the sole basis for critical decisions.

---

## Author

Attada Manoj

B.Tech Computer Science & Engineering (Cyber Security)

CMR College of Engineering & Technology
