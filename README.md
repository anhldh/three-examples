# Three.js Resource Hub 🚀

Dự án tổng hợp các ví dụ, hiệu ứng đồ họa 3D, kỹ thuật xử lý model, Shader (GLSL), mô phỏng và các phương pháp tối ưu hiệu năng trong **Three.js** và **React Three Fiber (R3F)**.

Project được xây dựng như một **sandbox / resource hub** để thử nghiệm các công nghệ 3D trên web, từ GLTF, PLY, Gaussian Splatting, 3D Tiles cho tới shader, navigation, camera controls và simulation.

Toàn bộ dự án sử dụng **Bun** để quản lý dependencies và chạy development server.

---

## 🛠️ Tech Stack

- **Runtime & Package Manager:** [Bun](https://bun.sh/)
- **Core 3D Engine:** [Three.js](https://threejs.org/)
- **React Renderer:** [React Three Fiber (R3F)](https://r3f.docs.pmnd.rs/)
- **Helpers & Controls:** [@react-three/drei](https://github.com/pmndrs/drei)
- **Camera Controls:** [camera-controls](https://github.com/yomotsu/camera-controls)
- **UI Controls:** [Leva](https://github.com/pmndrs/leva)
- **Shader:** Custom GLSL - Vertex Shader & Fragment Shader
- **Model Formats:** GLB / GLTF / PLY
- **3D Tiles:** `3d-tiles-renderer`
- **Geospatial 3D:** CesiumJS
- **Gaussian Splatting:** Spark
- **Web Model Viewer:** Google `<model-viewer>`
- **Post-processing:** Bloom và các hiệu ứng hậu kỳ khác

---

## 📂 Examples

Các ví dụ hiện có trong project:

| ID                       | Example                        | Mô tả                                                                                                                          | Tags                                           |
| :----------------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| 📦 **model**             | **Model / GLB / Shadow**       | Xem model GLB với ground shadow, environment HDR và điều khiển ánh sáng / ground trực tiếp thông qua Leva.                     | `react-three-fiber`, `drei`, `leva`, `shadow`  |
| ☁️ **ply**               | **PLY / Point Cloud**          | Kéo thả file `.ply` để xem dưới dạng point cloud hoặc mesh. Hỗ trợ cả ASCII và Binary PLY.                                     | `three.js`, `point-cloud`, `mesh`, `drag-drop` |
| 📉 **lod**               | **GLTF / LOD**                 | Hiển thị GLTF với nhiều mức độ chi tiết bằng kỹ thuật LOD (Level of Detail) nhằm giảm tài nguyên render khi model ở xa camera. | `three.js`, `gltf`, `lod`                      |
| 🎯 **animation-pointer** | **Animation / Pointer**        | Thử nghiệm xử lý Animation Pointer với model GLTF và animation phức tạp.                                                       | `three.js`, `gltf`, `animation-pointer`        |
| 🚂 **train**             | **Game / Train**               | Thử nghiệm xây dựng game và các interaction cơ bản bằng Three.js.                                                              | `three.js`, `gltf`, `game`                     |
| 🧭 **path**              | **NavMesh / Path Finding**     | Thử nghiệm tìm đường cho nhân vật bên trong môi trường 3D sử dụng NavMesh và path finding.                                     | `three.js`, `navmesh`, `path`                  |
| 🧪 **nobook**            | **NoBook / Simulation**        | Thử nghiệm xây dựng các mô phỏng tương tác theo hướng ứng dụng học tập / simulation tương tự NoBook.                           | `three.js`, `simulation`, `nobook`             |
| 📱 **model-viewer**      | **Model Viewer / Google**      | Hiển thị GLB với nhiều mức độ chi tiết nhằm thử nghiệm tối ưu model cho Google `<model-viewer>` trên web/mobile.               | `glb`, `lod`, `model-viewer`                   |
| ✨ **spark**             | **Spark / Gaussian Splatting** | Hiển thị dữ liệu Gaussian Splatting từ các file `.ply` và thử nghiệm rendering scene được scan từ môi trường thực tế.          | `three.js`, `gaussian-splatting`               |
| 💡 **environment-light** | **Environment / Light**        | Thử nghiệm các cấu hình ánh sáng và environment khác nhau để đánh giá cách material của model phản ứng với ánh sáng.           | `glb`, `light`, `environment`                  |
| 🔥 **fireball**          | **Shader / Fireball**          | Hiệu ứng quả cầu lửa sử dụng custom Vertex / Fragment Shader và các kỹ thuật noise.                                            | `three.js`, `shader`, `fire`                   |
| 💥 **explosion**         | **Shader / Explosion**         | Hiệu ứng vụ nổ được xây dựng bằng GLSL và các phép biến đổi trực tiếp trên GPU.                                                | `three.js`, `shader`, `explosion`              |
| ❄️ **snows**             | **Shader / Snow**              | Hệ thống tuyết rơi với số lượng particle lớn, xử lý chuyển động chủ yếu trên GPU bằng Shader.                                  | `three.js`, `shader`, `snow`                   |
| 🌧️ **rain**              | **Shader / Rain**              | Hiệu ứng mưa thời gian thực được render bằng custom Shader.                                                                    | `three.js`, `shader`, `rain`                   |
| 🗺️ **3dtiles**           | **3D Tiles / Viewer**          | Hiển thị và streaming tileset theo chuẩn 3D Tiles bằng `3d-tiles-renderer`.                                                    | `three.js`, `3d-tiles`, `streaming`            |
| 🌍 **cesium**            | **Cesium / 3D Tiles**          | Hiển thị cùng dữ liệu 3D Tiles bằng CesiumJS để thử nghiệm và so sánh với Three.js.                                            | `cesium`, `3d-tiles`                           |
| 🎥 **camera-controls**   | **Camera Controls / Demo**     | Demo các thao tác camera bằng thư viện `camera-controls`, phục vụ thử nghiệm orbit, focus và transition camera.                | `three.js`, `camera-controls`, `demo`          |

---

## 🔥 Nhóm ví dụ

### 📦 Model & Asset Rendering

Các ví dụ liên quan tới việc load, hiển thị và tối ưu tài nguyên 3D:

- GLB / GLTF Model Viewer
- PLY Point Cloud
- GLTF LOD
- Google `<model-viewer>`
- Environment Lighting
- Gaussian Splatting

---

### 🎨 Shader & Visual Effects

Các hiệu ứng được xử lý chủ yếu trên GPU bằng custom GLSL:

- Fireball
- Explosion
- Snow
- Rain

Các ví dụ tập trung vào:

- Vertex manipulation
- Fragment shading
- Procedural animation
- Noise
- Particle effects
- GPU-based animation

---

### 🎮 Interaction & Simulation

Các thử nghiệm liên quan tới interaction và logic bên trong môi trường 3D:

- Train Game
- Animation Pointer
- NoBook Simulation
- Camera Controls

---

### 🧭 Navigation & Path Finding

Thử nghiệm navigation trong môi trường 3D:

- NavMesh
- Path Finding
- Character Navigation

---

### 🌍 Large-scale 3D & Geospatial

Các thử nghiệm liên quan tới dữ liệu 3D kích thước lớn và streaming:

- 3D Tiles
- `3d-tiles-renderer`
- CesiumJS

Mục tiêu là thử nghiệm cách xử lý scene lớn mà không cần tải toàn bộ dữ liệu 3D ngay từ đầu.

---

## 🚀 Cài đặt

Project sử dụng **Bun**.

### 1. Clone repository

```bash
git clone <repository-url>
cd <project-folder>
```

### 2. Cài dependencies

```bash
bun install
```

### 3. Chạy development server

```bash
bun dev
```

Sau đó mở địa chỉ được hiển thị trong terminal.

---

## 📁 Cấu trúc Example

Mỗi example được định danh bằng một `id`, ví dụ:

```ts
{
  id: "fireball",
  title: "shader / fireball",
  description: "Hiển thị hiệu ứng fireball",
  tags: ["three.js", "shader", "fire"],
  image: "/example-thumbnail/6.jpg",
}
```

Danh sách hiện tại:

```text
model
ply
lod
spark
animation-pointer
train
path
nobook
model-viewer
environment-light
fireball
explosion
snows
rain
3dtiles
cesium
camera-controls
```

---

## 🎯 Mục tiêu của project

Project được tạo ra để lưu trữ và thử nghiệm các kỹ thuật Three.js thay vì chỉ tập trung vào một ứng dụng cụ thể.

Một số chủ đề chính:

- Rendering và xử lý model GLTF / GLB
- Point Cloud
- Gaussian Splatting
- Level of Detail
- Shader GLSL
- GPU particle effects
- Camera transition
- Animation
- Interaction
- NavMesh & Path Finding
- Simulation
- 3D Tiles
- Streaming dữ liệu 3D lớn
- CesiumJS
- Web performance optimization

Các example có thể được sử dụng như những playground độc lập để kiểm thử một kỹ thuật trước khi tích hợp vào project thực tế.

---

## 🧩 Các hướng thử nghiệm tiếp theo

Project có thể tiếp tục mở rộng với các chủ đề như:

- WebGPU
- Compute Shader
- BVH / `three-mesh-bvh`
- GPU Picking
- InstancedMesh
- Occlusion Culling
- Baked Lighting
- Physics
- WebXR / AR / VR
- Advanced Post-processing
- Large Scene Optimization
- Character Controller
- Spatial Partitioning
- Texture / Video Texture Optimization

---

## 📜 License

Project hiện được sử dụng chủ yếu cho mục đích nghiên cứu, thử nghiệm và lưu trữ các kỹ thuật liên quan tới **Three.js / Web 3D**.
