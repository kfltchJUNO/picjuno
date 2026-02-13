'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase'; // 경로 점 3개 확인!
import { doc, getDoc } from 'firebase/firestore';
import { useParams, useRouter, useSearchParams } from 'next/navigation'; // useSearchParams 추가됨
import Image from 'next/image';

export default function AlbumDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams(); // 주소창의 쿼리(?code=...)를 읽는 도구
  
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(''); // 에러 메시지 표시용
  
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchAlbum = async () => {
      // ID가 없으면 실행하지 않음 (Next.js 오류 방지)
      if (!id) return;

      try {
        console.log("Fetching album ID:", id); // 디버깅용 로그

        const docRef = doc(db, 'albums', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setAlbum(data);
          
          // 1. 공개 앨범이면 바로 잠금 해제
          if (!data.isSecret) {
            setIsLocked(false);
          } 
          // 2. ★ 핵심: 주소창에 있는 코드(?code=...)와 앨범 비번이 같으면 자동 해제!
          else if (searchParams.get('code') === data.password) {
            setIsLocked(false);
          }

        } else {
          // 앨범이 DB에 없을 때
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

  // 비밀번호 직접 입력 확인 (링크 공유로 들어왔을 때)
  const checkPassword = (e) => {
    e.preventDefault();
    if (album && album.password === passwordInput) {
      setIsLocked(false);
    } else {
      alert('비밀번호가 틀렸습니다.');
      setPasswordInput('');
    }
  };

  const handleDownload = async (imageUrl, index) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${album.title}_${index + 1}.jpg`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      alert('다운로드 오류. 이미지를 길게 눌러 저장하세요.');
    }
  };

  // 1. 로딩 중
  if (loading) return <div className="text-center py-20">Loading...</div>;

  // 2. 에러 발생 (앨범 없음 등) - 바로 튕기지 않고 메시지를 보여줌
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
  
  // 3. 앨범 데이터가 아직 없을 때 (안전장치)
  if (!album) return null;

  // 4. 잠겨있는 상태
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
            <button 
              type="button" 
              onClick={() => router.push('/')}
              className="text-sm text-gray-400 underline"
            >
              메인으로 돌아가기
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 5. 갤러리 화면 (잠금 해제됨)
  return (
    <div className="min-h-screen bg-white pb-20">
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="text-2xl">←</button>
        <h1 className="font-bold text-lg truncate max-w-[200px]">{album.title}</h1>
        <div className="w-8"></div>
      </nav>

      <main className="p-4">
        {album.photos.length === 0 ? (
           <div className="text-center py-20 text-gray-400">사진이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {album.photos.map((url, index) => (
              <div 
                key={index} 
                onClick={() => setSelectedImage({ url, index })}
                className="relative aspect-square cursor-pointer bg-gray-100 rounded-lg overflow-hidden"
              >
                <Image
                  src={url}
                  alt={`Photo ${index + 1}`}
                  fill
                  className="object-cover hover:scale-110 transition-transform duration-300"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        )}
      </main>

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
              onClick={() => handleDownload(selectedImage.url, selectedImage.index)}
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