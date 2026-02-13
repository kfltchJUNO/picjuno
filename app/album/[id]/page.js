'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // updateDoc 추가됨
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function AlbumDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams(); 
  
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(''); 
  
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  // ★ 정렬 상태 ('latest': 최신순, 'popular': 인기순, 'random': 랜덤)
  const [sortOrder, setSortOrder] = useState('latest');

  useEffect(() => {
    const fetchAlbum = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'albums', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          // ★ 기존 단순 URL 배열을 객체(하트 수 포함)로 안전하게 변환
          const normalizedPhotos = (data.photos || []).map((p) => 
            typeof p === 'string' 
              ? { id: p, url: p, likes: 0, addedAt: data.createdAt?.toMillis() || 0 } 
              : p
          );
          
          setAlbum({ ...data, photos: normalizedPhotos });
          
          if (!data.isSecret) {
            setIsLocked(false);
          } else if (searchParams.get('code') === data.password) {
            setIsLocked(false);
          }
        } else {
          setErrorMsg('앨범을 찾을 수 없습니다. (삭제되었거나 주소가 잘못됨)');
        }
      } catch (error) {
        console.error("Error fetching album:", error);
        setErrorMsg('앨범을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchAlbum();
  }, [id, searchParams]);

  // ★ 좋아요(하트) 클릭 처리 함수
  const handleLike = async (photoId, e) => {
    e.stopPropagation(); // 사진 확대되는 것 방지
    
    // 중복 방지 (브라우저 로컬스토리지 이용)
    const likeKey = `liked_${id}_${photoId}`;
    if (localStorage.getItem(likeKey)) {
      alert('이미 하트를 누르셨습니다! ❤️');
      return;
    }

    // 1. 화면 즉시 업데이트 (빠른 반응속도를 위해)
    setAlbum(prev => {
      const updatedPhotos = prev.photos.map(p => 
        p.id === photoId ? { ...p, likes: (p.likes || 0) + 1 } : p
      );
      return { ...prev, photos: updatedPhotos };
    });
    
    // 로컬스토리지에 저장
    localStorage.setItem(likeKey, 'true');

    // 2. 파이어베이스 실제 데이터 업데이트
    try {
      const docRef = doc(db, 'albums', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const currentData = docSnap.data();
        const updatedDbPhotos = currentData.photos.map(p => {
          const currentId = typeof p === 'string' ? p : p.id;
          if (currentId === photoId) {
            return typeof p === 'string' 
              ? { id: p, url: p, likes: 1, addedAt: Date.now() } 
              : { ...p, likes: (p.likes || 0) + 1 };
          }
          return p;
        });
        await updateDoc(docRef, { photos: updatedDbPhotos });
      }
    } catch (error) {
      console.error("좋아요 업데이트 실패", error);
    }
  };

  // ★ 정렬 로직 (비밀 폴더는 관리자 업로드 순 = 최신순 고정)
  const sortedPhotos = useMemo(() => {
    if (!album || !album.photos) return [];
    let photosToSort = [...album.photos];
    
    if (album.isSecret) return photosToSort; // 비밀 폴더는 정렬하지 않음 (기본순)

    if (sortOrder === 'popular') {
      return photosToSort.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (sortOrder === 'random') {
      return photosToSort.sort(() => Math.random() - 0.5);
    } else {
      // 최신순 (addedAt 기준, 없으면 배열 인덱스 유지)
      return photosToSort.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
  }, [album, sortOrder]);

  const checkPassword = (e) => {
    e.preventDefault();
    if (album && album.password === passwordInput) {
      setIsLocked(false);
    } else {
      alert('비밀번호가 틀렸습니다.');
      setPasswordInput('');
    }
  };

  const handleDownload = async (imageUrl, title) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title}_PicJuno.jpg`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      alert('다운로드 오류. 이미지를 길게 눌러 저장하세요.');
    }
  };

  if (loading) return <div className="text-center py-20">Loading...</div>;

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <div className="text-4xl mb-4">😢</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">오류 발생</h2>
        <p className="text-gray-500 mb-6">{errorMsg}</p>
        <button onClick={() => router.push('/')} className="bg-blue-600 text-white px-6 py-2 rounded-full">
          홈으로 돌아가기
        </button>
      </div>
    );
  }
  
  if (!album) return null;

  if (isLocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">비공개 앨범입니다</h2>
          <p className="text-gray-500 text-sm mb-6">작성자(선생님)에게 받은<br/>비밀번호를 입력해주세요.</p>
          <form onSubmit={checkPassword} className="space-y-4">
            <input
              type="text"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full p-3 border rounded-lg text-center"
              placeholder="비밀번호 입력"
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
              확인
            </button>
            <button type="button" onClick={() => router.push('/')} className="text-sm text-gray-400 underline">
              메인으로 돌아가기
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="text-2xl">←</button>
        <h1 className="font-bold text-lg truncate max-w-[200px]">{album.title}</h1>
        <div className="w-8"></div>
      </nav>

      <main className="p-4 max-w-6xl mx-auto">
        
        {/* ★ 공개 앨범일 경우에만 노출되는 정렬 버튼 */}
        {!album.isSecret && album.photos.length > 0 && (
          <div className="flex justify-center space-x-2 mb-6 mt-2">
            <button onClick={() => setSortOrder('latest')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${sortOrder === 'latest' ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>최신순</button>
            <button onClick={() => setSortOrder('popular')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${sortOrder === 'popular' ? 'bg-pink-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>인기순 🔥</button>
            <button onClick={() => setSortOrder('random')} className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${sortOrder === 'random' ? 'bg-indigo-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>랜덤 🎲</button>
          </div>
        )}

        {sortedPhotos.length === 0 ? (
           <div className="text-center py-20 text-gray-400">사진이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sortedPhotos.map((photo, index) => (
              <div key={photo.id || index} className="flex flex-col">
                <div 
                  onClick={() => setSelectedImage(photo)}
                  className="relative aspect-square cursor-pointer bg-gray-100 rounded-xl overflow-hidden shadow-sm"
                >
                  <Image
                    src={photo.url}
                    alt={`Photo`}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
                
                {/* ★ 하단 좋아요(하트) 영역 */}
                <div className="flex justify-between items-center px-1 mt-2">
                  <button 
                    onClick={(e) => handleLike(photo.id, e)}
                    className="flex items-center space-x-1 text-gray-500 hover:text-pink-500 transition-colors group"
                  >
                    <span className="text-xl group-active:scale-150 transition-transform">
                      {localStorage.getItem(`liked_${id}_${photo.id}`) ? '❤️' : '🤍'}
                    </span>
                    <span className="text-sm font-bold">{photo.likes || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 사진 확대 뷰어 */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in">
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white text-4xl font-light z-50"
          >
            &times;
          </button>
          <div className="relative w-full h-[70vh] max-w-4xl">
            <Image
              src={selectedImage.url}
              alt="Full screen"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="absolute bottom-10 flex flex-col items-center gap-4 w-full px-6">
            <button
              onClick={() => handleDownload(selectedImage.url, album.title)}
              className="bg-white text-black px-8 py-3 rounded-full font-bold shadow-lg flex items-center space-x-2 hover:bg-gray-200 transition"
            >
              <span>⬇ 저장하기</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}