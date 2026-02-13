'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// 배열 섞기(랜덤) 함수
function shuffleArray(array) {
  let shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function HomePage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('public');
  const [publicPhotos, setPublicPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [secretCode, setSecretCode] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [siteSubtitle, setSiteSubtitle] = useState('Picturewrite by Juno.');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().subtitle) {
          setSiteSubtitle(docSnap.data().subtitle);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    const fetchPublicPhotos = async () => {
      try {
        const q = query(collection(db, 'albums'), where('isSecret', '==', false), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        let allPhotos = [];
        querySnapshot.docs.forEach(docSnap => {
          const album = { id: docSnap.id, ...docSnap.data() };
          if (album.photos && album.photos.length > 0) {
            album.photos.forEach(photo => {
              const photoObj = typeof photo === 'string' 
                ? { id: photo, url: photo, likes: 0 } 
                : photo;
              // 앨범 정보를 사진 객체에 추가
              allPhotos.push({ ...photoObj, albumId: album.id, albumTitle: album.title });
            });
          }
        });
        
        // ★ 모든 사진을 랜덤하게 섞어서 세팅
        setPublicPhotos(shuffleArray(allPhotos));
      } catch (error) {
        console.error("Error fetching photos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    fetchPublicPhotos();
  }, []);

  const handleSecretLogin = async (e) => {
    e.preventDefault();
    if (!secretCode) return;
    setSearchLoading(true);
    try {
      const q = query(collection(db, 'albums'), where('password', '==', secretCode));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        alert('존재하지 않는 코드이거나, 기간이 만료되어 삭제된 폴더입니다.');
      } else {
        const albumId = querySnapshot.docs[0].id;
        router.push(`/album/${albumId}?code=${secretCode}`);
      }
    } catch (error) {
      console.error("Login error:", error);
      alert('오류가 발생했습니다.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDownload = async (imageUrl, title) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `PicJuno_${title}.jpg`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      alert('다운로드 오류. 이미지를 길게 눌러 저장하세요.');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="pt-12 pb-8 px-6 text-center">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="relative w-12 h-12 shadow-md rounded-xl overflow-hidden bg-gray-50">
            <Image src="/logo.png" alt="PicJuno Logo" fill className="object-cover" priority />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight font-sans">
            PicJuno
          </h1>
        </div>
        <p className="text-gray-500 text-lg font-light break-keep">{siteSubtitle}</p>
      </header>

      <div className="flex justify-center mb-10">
        <div className="bg-gray-100 p-1 rounded-full inline-flex">
          <button onClick={() => setActiveTab('public')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${activeTab === 'public' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            공개 갤러리
          </button>
          <button onClick={() => setActiveTab('secret')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${activeTab === 'secret' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            비밀 접속
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pb-20">
        
        {/* ================= 공개 갤러리 (랜덤 조적식 레이아웃) ================= */}
        {activeTab === 'public' && (
          <div>
            {loading ? (
              <div className="text-center py-20 text-gray-400">Loading photos...</div>
            ) : publicPhotos.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-2xl">
                <p className="text-gray-400">등록된 사진이 없습니다.</p>
              </div>
            ) : (
              // ★ 이미지 원본 비율을 유지하며 지그재그로 쌓이는 Masonry 디자인
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {publicPhotos.map((photo, index) => (
                  <div 
                    key={photo.id || index} 
                    onClick={() => setSelectedImage(photo)}
                    className="break-inside-avoid relative group rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all mb-4"
                  >
                    <img 
                      src={photo.url} 
                      alt="Gallery image" 
                      className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    {/* 마우스 올렸을 때 뜨는 정보 */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                      <span className="text-white text-sm font-bold truncate pr-2">{photo.albumTitle}</span>
                      <span className="text-white text-sm font-bold">❤️ {photo.likes || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= 비밀 접속 탭 ================= */}
        {activeTab === 'secret' && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-full max-w-md bg-gray-50 p-8 rounded-2xl border border-gray-100 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">🔒</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">비공개 앨범 접속</h2>
              <p className="text-gray-500 text-sm mb-6">전달받은 비밀번호를 입력해주세요.</p>
              <form onSubmit={handleSecretLogin} className="space-y-4">
                <input type="text" value={secretCode} onChange={(e) => setSecretCode(e.target.value)} placeholder="코드를 입력하세요" className="w-full p-4 text-center text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white" />
                <button type="submit" disabled={searchLoading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                  {searchLoading ? '확인 중...' : '앨범 열기 🔓'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ================= 메인화면 사진 뷰어 (모달) ================= */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in">
          <button onClick={() => setSelectedImage(null)} className="absolute top-6 right-6 text-white/70 hover:text-white text-4xl font-light z-50">&times;</button>
          
          <div className="absolute top-6 left-6 text-white z-50">
            <p className="text-lg font-bold">{selectedImage.albumTitle}</p>
            <p className="text-sm text-gray-300">❤️ {selectedImage.likes || 0}</p>
          </div>

          <div className="relative w-full h-[70vh] max-w-4xl">
            <Image src={selectedImage.url} alt="Full screen" fill className="object-contain" priority />
          </div>
          
          <div className="absolute bottom-10 flex flex-wrap justify-center gap-4 w-full px-6">
            <button onClick={() => router.push(`/album/${selectedImage.albumId}`)} className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition">
              이 앨범 보러가기 📂
            </button>
            <button onClick={() => handleDownload(selectedImage.url, selectedImage.albumTitle)} className="bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg flex items-center space-x-2 hover:bg-gray-200 transition">
              <span>⬇ 원본 저장</span>
            </button>
          </div>
        </div>
      )}

      <footer className="text-center text-gray-400 text-sm py-10 border-t border-gray-100 mt-10">
        &copy; {new Date().getFullYear()} PicJuno. All rights reserved.
      </footer>
    </div>
  );
}