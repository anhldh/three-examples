# Three.js Resource Hub 🚀

Dự án tổng hợp các ví dụ, hiệu ứng đồ họa 3D, ứng dụng Shader (GLSL) nâng cao và các kỹ thuật tối ưu hóa hiệu năng trong **Three.js** và **React Three Fiber (R3F)**. Toàn bộ dự án được phát triển và quản lý bằng **Bun** để đạt tốc độ khởi chạy và tối ưu hóa tốt nhất.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Runtime & Package Manager:** [Bun](https://bun.sh/)
- **Core 3D Engine:** [Three.js](https://threejs.org/)
- **React Wrapper:** [React Three Fiber (R3F)](https://r3f.docs.pmnd.rs/)
- **Helpers & Controls:** [@react-three/drei](https://github.com/pmndrs/drei)
- **UI Controls:** [Leva](https://github.com/pmndrs/leva)
- **Shader:** Custom GLSL (Vertex & Fragment Shaders)
- **Khác:** Google `<model-viewer>`, Gaussian Splatting, Post-processing (Bloom).

---

## 📂 Danh sách các ví dụ & Tính năng (Examples)

Dưới đây là các tính năng và ví dụ thực tế được tích hợp trong project:

| ID                       | Tên Ví Dụ (Title)         | Mô Tả (Description)                                                                                                         | Công Nghệ / Tags                                 |
| :----------------------- | :------------------------ | :-------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| 📦 **model**             | **Model Viewer**          | Xem model GLB với ground shadow, environment HDR và tùy chỉnh ánh sáng trực tiếp qua bảng điều khiển Leva.                  | `react-three-fiber`, `drei`, `leva`, `shadow`    |
| ☁️ **ply**               | **PLY Viewer**            | Kéo thả file `.ply` để xem point cloud hoặc mesh 3D. Hỗ trợ cả định dạng ASCII và Binary PLY.                               | `three.js`, `point cloud`, `mesh`, `drag & drop` |
| 📉 **lod**               | **GLB LOD**               | Bộ hiển thị file GLTF tích hợp kỹ thuật nhiều mức độ chi tiết (LOD - Level of Detail) giúp tối ưu hiệu năng render.         | `three.js`, `gltf`, `lod`                        |
| ✨ **spark**             | **Spark Viewer**          | Bộ hiển thị dữ liệu quét 3D thời gian thực thông qua thuật toán Gaussian Splatting và định dạng file `.ply`.                | `three.js`, `gaussian-splatting`                 |
| 🎯 **animation-pointer** | **Animation Pointer**     | Xử lý và đồng bộ hóa các chuyển động (Animation Pointer) dựa trên mô hình GLTF phức tạp.                                    | `three.js`, `gltf`, `animation-pointer`          |
| 📱 **model-viewer**      | **Model Viewer (Google)** | Hiển thị tệp GLB tối ưu hóa với các mức độ chi tiết (LOD) phục vụ cho thư viện `<model-viewer>` của Google trên web/mobile. | `glb`, `lod`, `model-viewer`                     |
| 💡 **environment-light** | **Environment Light**     | Cấu hình và giả lập các nguồn sáng môi trường đa dạng để hiển thị bề mặt vật liệu của model một cách chân thực nhất.        | `glb`, `light`, `environment`                    |
| 🔥 **fireball**          | **Fireball**              | Hiệu ứng quả cầu lửa chuyển động chân thực bằng cách viết custom Fragment & Vertex Shader (FBM Noise).                      | `three.js`, `shader`, `fire`                     |
| 💥 **explosion**         | **Explosion**             | Hiệu ứng vụ nổ vật lý sinh động điều khiển thông qua cấu trúc toán học trong Shader.                                        | `three.js`, `shader`, `explosion`                |
| ❄️ **snows**             | **Snow**                  | Hệ thống giả lập các hạt tuyết rơi mật độ lớn trên màn hình, chạy mượt mà bằng sức mạnh của GPU Shader.                     | `three.js`, `shader`, `snow`                     |

---

## 🚀 Hướng dẫn cài đặt và Khởi chạy

Vì dự án sử dụng **Bun**, tốc độ cài đặt và chạy server sẽ nhanh hơn rất nhiều so với npm/yarn truyền thống.

### 1. Cài đặt các dependencies

Mở terminal tại thư mục gốc của dự án và chạy lệnh sau:
