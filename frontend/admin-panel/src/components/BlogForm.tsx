import axios from 'axios';
import { useEffect, useState } from 'react';

const BlogForm = () => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    slug: '',
    cover: '',
  });

  const [covers, setCovers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch existing covers from S3 via backend or direct
    // For simplicity, assume backend has /v1/upload/list?directory=blog/covers endpoint (need to add)
    // Or list from MinIO if public
    const fetchCovers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('adminToken');
        const response = await axios.get('/v1/upload/list?directory=blog/covers', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setCovers(response.data);
      } catch (err) {
        console.error('Failed to fetch covers', err);
      }
      setLoading(false);
    };
    fetchCovers();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await axios.post('/v1/blog', formData);
      // ... existing success logic ...
    } catch (err) {
      // ... existing error logic ...
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" value={formData.title} onChange={handleChange} placeholder="Title" />
      <textarea
        name="content"
        value={formData.content}
        onChange={handleChange}
        placeholder="Content"
      />
      <input name="slug" value={formData.slug} onChange={handleChange} placeholder="Slug" />
      <div>
        <label> Cover</label>
        <select
          value={formData.cover}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setFormData({ ...formData, cover: e.target.value })
          }
        >
          <option value="">Select existing cover</option>
          {covers.map((cover) => (
            <option key={cover} value={cover}>
              {cover.split('/').pop()}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept="image/*"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
              const uploadData = new FormData();
              uploadData.append('file', file);
              uploadData.append('directory', 'blog/covers');

              const token = localStorage.getItem('adminToken');
              axios
                .post('/v1/upload', uploadData, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                  },
                })
                .then((res) => {
                  const newCover = res.data.path;
                  setFormData((prev) => ({ ...prev, cover: newCover }));
                  setCovers((prev) => [...prev, newCover]);
                })
                .catch((err) => console.error('Upload failed', err));
            }
          }}
        />
      </div>
      <button type="submit">Create</button>
    </form>
  );
};

export default BlogForm;
