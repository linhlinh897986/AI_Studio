import React from 'react';
import { ShoppingBag, Compass, Smile, Video, ArrowRight, Settings, Terminal, Activity, Tv } from 'lucide-react';

export default function Dashboard({ activeTab, setActiveTab, logs = [] }) {
  const stats = [
    { 
      id: 'shopee', 
      title: 'Shopee Review', 
      desc: 'Tạo video review từ link sản phẩm Shopee VN', 
      icon: <ShoppingBag size={24} />, 
      color: 'var(--shpee-orange)', 
      count: 'Hỗ trợ QR & giá' 
    },
    { 
      id: 'buddhist', 
      title: 'Phật Pháp', 
      desc: 'Video triết lý tâm an kết hợp ảnh AI thiền định', 
      icon: <Compass size={24} />, 
      color: 'var(--success-zen)', 
      count: 'Hiệu ứng môi trường' 
    },
    { 
      id: 'stickman', 
      title: 'Người Que AI', 
      desc: 'Câu chuyện hài hước người que Bob qua nét vẽ AI', 
      icon: <Smile size={24} />, 
      color: 'var(--primary)', 
      count: 'Bong bóng hội thoại' 
    }
  ];

  return (
    <div className="tab-content" style={{ flexDirection: 'column', gap: 32 }}>
      {/* Welcome Banner */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: 'var(--font-display)', marginBottom: 8, background: 'linear-gradient(to right, #fff, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Chào mừng bạn đến với ViGen AIO
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 600, lineHeight: 1.6 }}>
            Công cụ sản xuất video tự động bằng AI thế hệ mới. Hỗ trợ tạo video ngắn tự động cho các kênh tiếp thị liên kết Shopee, chia sẻ phật pháp, truyện tranh vui nhộn và lồng tiếng dịch thuật thông minh.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('settings')}>
          <Settings size={16} /> Cấu hình API Key
        </button>
      </div>

      {/* Grid of Tools */}
      <div>
        <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} /> Chọn mô-đun sản xuất
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {stats.map((item) => (
            <div 
              key={item.id} 
              className="glass-panel" 
              style={{ display: 'flex', flexDirection: 'column', gap: 16, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
              onClick={() => setActiveTab(item.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                  {item.count}
                </span>
              </div>
              <div>
                <h4 style={{ fontSize: 16, color: '#fff', marginBottom: 6 }}>{item.title}</h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: item.color, fontWeight: 600, marginTop: 'auto', paddingTop: 8 }}>
                Bắt đầu ngay <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background Console Logs Logger */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={16} /> Console Logs Hệ thống
        </h3>
        <div className="console-box">
          {logs.length > 0 ? (
            logs.map((log, idx) => (
              <div key={idx} className={`console-line ${log.type}`}>
                [{log.timestamp}] [{log.tab}] {log.text}
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '30px 0' }}>
              Chưa có hoạt động nào được ghi nhận. Bắt đầu sản xuất video để xem log hệ thống.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
