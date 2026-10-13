---
title: Kinect v2 Projector Calibration on macOS
slug: kinect-projector-calibration
tagline: Getting projected light onto a moving body when the camera and the projector stand in different places
description: >-
  Calibration tools on my fork of libfreenect2 that work out where a projector
  sits relative to a Kinect v2 on a Mac, so the light lands on a performer at
  any depth.
language: Python / OpenCV
role: Built
year: 2026
order: 20
tech:
  - libfreenect2
  - Python
  - OpenCV
  - Syphon
  - Gray-code structured light
  - TouchDesigner
client: Live performance / personal creative project
github_url: https://github.com/Wingie/libfreenect2
videos:
  - src: https://media.creativecodingtech.com/videos/kinect-projector-calibration-07.mp4
    poster: https://media.creativecodingtech.com/videos/kinect-projector-calibration-07.jpg
    caption: "The Kinect's point cloud, coloured by height."
  - src: https://media.creativecodingtech.com/videos/kinect-projector-calibration-23.mp4
    poster: https://media.creativecodingtech.com/videos/kinect-projector-calibration-23.jpg
    caption: "The calibration page masks the cloth the projector hits."
  - src: https://media.creativecodingtech.com/videos/kinect-projector-calibration-24.mp4
    poster: https://media.creativecodingtech.com/videos/kinect-projector-calibration-24.jpg
    caption: "Depth from above, coloured by distance."
  - src: https://media.creativecodingtech.com/videos/kinect-projector-calibration-25.mp4
    poster: https://media.creativecodingtech.com/videos/kinect-projector-calibration-25.jpg
    caption: "A body steps into the depth map and shows up as its own shape."
---

Microsoft never released Kinect v2 drivers for macOS. TouchDesigner's Kinect operators only run on Windows, and there's no skeleton tracking on a Mac.

So I started from [libfreenect2](https://github.com/OpenKinect/libfreenect2), the OpenKinect driver, and work from Python on my fork through the pylibfreenect2 bindings. [KinectV2_Syphon](https://github.com/fred-dev/KinectV2_Syphon), an openFrameworks app by Frederick Rodrigues, sends the colour, depth and IR streams over Syphon. TouchDesigner reads them from there.

I want to project onto a performer. The Kinect sits off to the side, out of the beam. The projector throws from somewhere else. You need to know where one is relative to the other.

The first version used a gray-code scan. The projector shows striped patterns, and the camera records which projector pixel lit which camera pixel. That lookup table is right for the surface it scanned. A performer standing a metre in front of the cloth got lit where her shadow would fall.

Now the projector is solved as a camera in reverse. I pair the scan with metric depth from the Kinect and fit its focal length, position and angle. On a synthetic projector the fit recovers focal length to 0.3% and position to 11 mm. In the first test on the rig, the lookup put the light on a forearm. The fitted model put it on the torso.

Most of the work wasn't the solver:

- I'd assumed the camera image was flipped. Testing all four orientations took the inliers from 21.1% to 35.8%.
- A flat set lets focal length and distance trade off. Some fits put the projector 6 m away. The fit now refuses itself past 4 m, under 30% inliers, or over 3 px of error.
- A black harness absorbed the scan patterns and weakened the depth reading. It has to be whitened for scanning or tracked from the IR image.
- IR tracking isn't affected by the projector's light, so you can track and project at the same time.
- 2 seconds after closing the Syphon app, libfreenect2 still found 0 devices. It now waits 6 seconds and retries.

This is the projection layer under my [performance rig](/projects/touchdesigner-performance-rig/).
