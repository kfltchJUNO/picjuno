'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function HomePage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState('public');
  const [publicAlbums, setPublicAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [secretCode, setSecretCode] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [siteSubtitle, setSiteSubtitle] = useState('Picturewrite by Juno.');

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

    const fetchPublicAlbums = async () => {
      try {
        const q = query(
          collection(db, 'albums'),
          where('isSecret', '==', false),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const albumsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setPublicAlbums(albumsData);
      } catch (error) {
        console.error("Error fetching albums:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    fetchPublicAlbums();
  }, []);

  const handleSecretLogin = async (e) => {
    e.preventDefault();
    if (!secretCode) return;
    
    setSearchLoading(true);
    try {
      const q = query(
        collection(db, 'albums'),
        where('password', '==', secretCode)
      );
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

  return (
    <div className="min-h-screen bg-white">
      <header className="pt-12 pb-8 px-6 text-center">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="relative w-12 h-12 shadow-md rounded-xl overflow-hidden bg-gray-50">
            <Image 
              src="/logo.png" 
              alt="PicJuno Logo" 
              fill 
              className="object-cover" 
              priority 
            />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight font-sans">
            PicJuno
          </h1>
        </div>
        <p className="text-gray-500 text-lg font-light break-keep">
          {siteSubtitle}
        </p>
      </header>

      <div className="flex justify-center mb-10">
        <div className="bg-gray-100 p-1 rounded-full inline-flex">
          <button
            onClick={() => setActiveTab('public')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
              activeTab === 'public' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            공개 갤러리
          </button>
          <button
            onClick={() => setActiveTab('secret')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
              activeTab === 'secret' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            비밀 접속
          </button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-20">
        {activeTab === 'public' && (
          <div>
            {loading ? (
              <div className="text-center py-20 text-gray-400">
                Loading albums...
              </div>
            ) : publicAlbums.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-2xl">
                <p className="text-gray-400">등록된 앨범이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {publicAlbums.map((album) => (
                  <div 
                    key={album.id} 
                    onClick={() => router.push(`/album/${album.id}`)}
                    className="group cursor-pointer block"
                  >
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 mb-3 shadow-sm group-hover:shadow-md transition-all">
                      {album.photos && album.photos[0] ? (
                        <Image
                          src={album.photos[0]}
                          alt={album.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          No Image
                        </div>
                      )}
                      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
                        {album.photos?.length || 0}장
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {album.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {album.createdAt?.seconds 
                        ? new Date(album.createdAt.seconds * 1000).toLocaleDateString() 
                        : 'Just now'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'secret' && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-full max-w-md bg-gray-50 p-8 rounded-2xl border border-gray-100 text-center shadow-sm">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                🔒
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                비공개 앨범 접속
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                전달받은 비밀번호를 입력해주세요.
              </p>
              
              <form onSubmit={handleSecretLogin} className="space-y-4">
                {/* ★ 이 부분이 수정되었습니다: placeholder 변경 */}
                <input
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  placeholder="코드를 입력하세요"
                  className="w-full p-4 text-center text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  {searchLoading ? '확인 중...' : '앨범 열기 🔓'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-gray-400 text-sm py-10 border-t border-gray-100 mt-10">
        &copy; {new Date().getFullYear()} PicJuno. All rights reserved.
      </footer>
    </div>
  );
}