'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from '../../lib/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, doc, deleteDoc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Draggable from 'react-draggable';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminTab, setAdminTab] = useState('upload'); 

  // --- 로그인 상태 ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- 앨범 업로드 상태 ---
  const [albumTitle, setAlbumTitle] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [albumPassword, setAlbumPassword] = useState('');
  
  // ★ 사진 파일들을 누적해서 담을 배열 상태
  const [files, setFiles] = useState([]); 
  const [previewUrl, setPreviewUrl] = useState(null); 
  
  const [isUploading, setIsUploading] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // --- 워터마크 상태 ---
  const [useWatermark, setUseWatermark] = useState(false);
  const [wmText, setWmText] = useState('Picturewrite by Juno.');
  const [wmColor, setWmColor] = useState('#ffffff');
  const [wmSize, setWmSize] = useState(40);
  const [wmOpacity, setWmOpacity] = useState(0.8);
  const [wmPosition, setWmPosition] = useState({ x: 0, y: 0 });
  const previewImgRef = useRef(null);
  const draggableRef = useRef(null); 
  const [presets, setPresets] = useState([]);

  // --- 앨범 관리(삭제) 상태 ---
  const [albumsList, setAlbumsList] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null); 

  // --- 앱 설정 상태 ---
  const [siteSubtitle, setSiteSubtitle] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    const savedPresets = localStorage.getItem('wmPresets');
    if (savedPresets) setPresets(JSON.parse(savedPresets));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      if (adminTab === 'manage') {
        fetchAlbumsList();
        setSelectedAlbum(null);
      } else if (adminTab === 'settings') {
        fetchSettings();
      }
    }
  }, [adminTab, user]);

  // ★ 파일이 추가되거나 삭제될 때마다 워터마크 미리보기용 사진(첫 번째 사진) 업데이트
  useEffect(() => {
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [files]);

  const fetchAlbumsList = async () => {
    const q = query(collection(db, 'albums'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setAlbumsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'general');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().subtitle) {
        setSiteSubtitle(docSnap.data().subtitle);
      } else {
        setSiteSubtitle('Picturewrite by Juno.'); 
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), { subtitle: siteSubtitle }, { merge: true });
      alert('앱 설정이 성공적으로 저장되었습니다! 메인 화면에 즉시 반영됩니다.');
    } catch (error) {
      console.error("Error saving settings:", error);
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert('로그인 실패: 정보를 확인하세요.');
    }
  };

  const handleDeleteAlbum = async (albumId, photoUrls) => {
    if (!confirm('경고: 이 앨범과 내부의 모든 사진 파일이 영구적으로 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      if (photoUrls && photoUrls.length > 0) {
        const deletePromises = photoUrls.map((url) => {
          const fileRef = ref(storage, url);
          return deleteObject(fileRef).catch(e => console.log('File already deleted', e));
        });
        await Promise.all(deletePromises);
      }
      await deleteDoc(doc(db, 'albums', albumId));
      alert('앨범이 파이어베이스에서 완전히 삭제되었습니다.');
      fetchAlbumsList(); 
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeletePhoto = async (albumId, photoUrl, currentPhotos) => {
    if (!confirm('이 사진을 파이어베이스에서 영구 삭제하시겠습니까?')) return;
    try {
      const fileRef = ref(storage, photoUrl);
      await deleteObject(fileRef).catch(e => console.log('File already deleted', e));
      const updatedPhotos = currentPhotos.filter(url => url !== photoUrl);
      await updateDoc(doc(db, 'albums', albumId), { photos: updatedPhotos });
      alert('사진이 삭제되었습니다.');
      setSelectedAlbum(prev => ({ ...prev, photos: updatedPhotos }));
      fetchAlbumsList(); 
    } catch (error) {
      console.error('Delete photo error:', error);
      alert('사진 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleCopyLink = (album) => {
    const url = `${window.location.origin}/album/${album.id}${album.isSecret ? `?code=${album.password}` : ''}`;
    let text = `[PicJuno] 사진 도착!\n👉 주소: ${url}`;
    if (album.isSecret) {
      text += `\n🔒 비번: ${album.password}`;
    }
    navigator.clipboard.writeText(text).then(() => {
      alert('링크와 코드가 클립보드에 복사되었습니다!');
    });
  };

  // --- 사진 드래그 앤 드롭 및 누적 추가 로직 ---
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) processSelectedFiles(e.target.files);
  };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processSelectedFiles(e.dataTransfer.files);
  };
  
  // ★ 기존 파일에 새 파일을 덮어쓰지 않고 '추가(Append)' 합니다.
  const processSelectedFiles = (fileList) => {
    const newFiles = Array.from(fileList);
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
  };

  // ★ 업로드 대기 중인 개별 사진 삭제 함수
  const handleRemovePendingFile = (indexToRemove) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };
  // ---------------------------------------------

  const handleDragStop = (e, data) => setWmPosition({ x: data.x, y: data.y });
  const savePreset = () => {
    const name = prompt('현재 스타일 저장 이름:');
    if (!name) return;
    const newPreset = { name, text: wmText, color: wmColor, size: wmSize, opacity: wmOpacity };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('wmPresets', JSON.stringify(updated));
  };
  const applyPreset = (preset) => {
    setWmText(preset.text); setWmColor(preset.color); setWmSize(preset.size); setWmOpacity(preset.opacity);
  };
  const deletePreset = (index) => {
    if(!confirm('삭제하시겠습니까?')) return;
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    localStorage.setItem('wmPresets', JSON.stringify(updated));
  }
  
  const processFileWithWatermark = async (file) => {
    if (!useWatermark) return file;
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const previewWidth = previewImgRef.current.offsetWidth;
        const scale = img.width / previewWidth;
        ctx.font = `bold ${wmSize * scale}px sans-serif`;
        ctx.fillStyle = wmColor; ctx.globalAlpha = wmOpacity;
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 10 * scale;
        ctx.fillText(wmText, wmPosition.x * scale, (wmPosition.y * scale) + (wmSize * scale));
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.90);
      };
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!albumTitle || files.length === 0) return alert('제목과 사진은 필수입니다.');
    if (isSecret && !albumPassword) return alert('비밀번호를 설정해주세요.');
    setIsUploading(true);
    try {
      const processedFilesPromises = files.map(file => processFileWithWatermark(file));
      const processedFiles = await Promise.all(processedFilesPromises);
      const uploadPromises = processedFiles.map(async (file) => {
        const storageRef = ref(storage, `albums/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
      });
      const photoUrls = await Promise.all(uploadPromises);
      const docRef = await addDoc(collection(db, 'albums'), {
        title: albumTitle,
        isSecret: isSecret,
        password: isSecret ? albumPassword : null,
        photos: photoUrls,
        createdAt: serverTimestamp(),
      });
      setShareData({ id: docRef.id, title: albumTitle, password: isSecret ? albumPassword : null, url: window.location.origin });
      
      // 업로드 완료 후 장바구니 비우기
      setFiles([]); 
      setAlbumTitle('');
      setAlbumPassword('');
      alert('완료되었습니다!');
    } catch (error) {
      console.error(error); alert('업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <form onSubmit={handleLogin} className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">PicJuno 관리자</h2>
          <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 mb-4 border rounded border-gray-300" required />
          <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 mb-6 border rounded border-gray-300" required />
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded font-bold">로그인</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-20">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg">
        
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800">📸 PicJuno 스튜디오</h1>
          <button onClick={() => signOut(auth)} className="text-red-500 underline text-sm">로그아웃</button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          <button 
            onClick={() => setAdminTab('upload')} 
            className={`px-4 py-2 rounded-md font-bold transition-all ${adminTab === 'upload' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            새 사진 업로드
          </button>
          <button 
            onClick={() => setAdminTab('manage')} 
            className={`px-4 py-2 rounded-md font-bold transition-all ${adminTab === 'manage' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            앨범 관리 및 삭제
          </button>
          <button 
            onClick={() => setAdminTab('settings')} 
            className={`px-4 py-2 rounded-md font-bold transition-all ${adminTab === 'settings' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            앱 기본 설정
          </button>
        </div>

        {/* ==================== 1. 업로드 탭 ==================== */}
        {adminTab === 'upload' && (
          <div className="animate-fade-in">
             {shareData && (
                <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg text-center border border-green-200">
                  <p className="font-bold">🎉 업로드 완료!</p>
                  <button onClick={() => navigator.clipboard.writeText(`[PicJuno] 사진 도착!\n👉 주소: ${shareData.url}/album/${shareData.id || ''}${shareData.password ? `?code=${shareData.password}` : ''}\n${shareData.password ? `🔒 비번: ${shareData.password}` : ''}`).then(()=>alert('복사됨!'))} 
                     className="mt-2 bg-green-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm hover:bg-green-700">
                    📋 공유 텍스트 복사하기
                  </button>
                </div>
             )}

            <form onSubmit={handleUpload} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" value={albumTitle} onChange={e => setAlbumTitle(e.target.value)} placeholder="앨범 제목 (예: 2026 졸업식)" className="p-3 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" required />
                <div className="flex items-center space-x-2 border border-gray-300 p-3 rounded-lg bg-gray-50">
                    <input type="checkbox" checked={isSecret} onChange={e => setIsSecret(e.target.checked)} className="w-5 h-5 text-blue-600"/>
                    <span className="flex-1 font-medium text-gray-700">비밀 폴더</span>
                    {isSecret && <input type="text" value={albumPassword} onChange={e => setAlbumPassword(e.target.value)} placeholder="비밀번호" className="border p-1 w-32 rounded text-sm"/>}
                </div>
              </div>

              {/* 드래그 앤 드롭 영역 */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed p-8 rounded-lg text-center transition-colors 
                  ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
              >
                <input type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" id="fileInput"/>
                <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                  <span className="text-4xl mb-2">📷</span>
                  <span className="text-blue-600 font-bold hover:underline text-lg">
                    {files.length > 0 ? `현재 ${files.length}장 선택됨 (클릭하여 추가)` : "+ 사진 추가하기 (Drag & Drop)"}
                  </span>
                  <span className="text-sm text-gray-400 mt-2">여러 번에 나누어 사진을 계속 추가할 수 있습니다.</span>
                </label>
              </div>

              {/* ★ 새로 추가된 영역: 업로드 대기 중인 썸네일 리스트 및 개별 삭제 */}
              {files.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-end mb-3">
                    <h3 className="font-bold text-gray-700">📸 선택된 사진 ({files.length}장)</h3>
                    <button 
                      type="button" 
                      onClick={() => setFiles([])} 
                      className="text-sm text-red-500 hover:text-red-700 underline"
                    >
                      전체 비우기
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto p-2 bg-white rounded border border-gray-100 shadow-inner">
                    {files.map((file, index) => (
                      <div key={index} className="relative w-20 h-20 group rounded-md overflow-hidden border border-gray-200 shadow-sm">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt={`preview-${index}`} 
                          className="w-full h-full object-cover" 
                        />
                        {/* 호버 시 나타나는 빨간색 X 삭제 버튼 */}
                        <button 
                          type="button"
                          onClick={() => handleRemovePendingFile(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                          title="이 사진 빼기"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 워터마크 설정 영역 */}
              {files.length > 0 && previewUrl && (
                <div className="border rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <label className="flex items-center space-x-2 font-bold text-lg cursor-pointer">
                      <input type="checkbox" checked={useWatermark} onChange={e => setUseWatermark(e.target.checked)} className="w-5 h-5 text-blue-600" />
                      <span>워터마크 적용</span>
                    </label>
                    {useWatermark && (
                        <div className="flex space-x-2">
                            <select onChange={(e) => e.target.value && applyPreset(JSON.parse(e.target.value))} className="p-1 border rounded text-sm bg-gray-50">
                                <option value="">-- 스타일 불러오기 --</option>
                                {presets.map((p, i) => <option key={i} value={JSON.stringify(p)}>{p.name}</option>)}
                            </select>
                            <button type="button" onClick={savePreset} className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300">저장</button>
                        </div>
                    )}
                  </div>

                  {useWatermark && (
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-full md:w-1/3 space-y-4 bg-gray-50 p-4 rounded-lg">
                        <div><label className="text-xs text-gray-500 font-bold">텍스트 내용</label><input type="text" value={wmText} onChange={e => setWmText(e.target.value)} className="w-full p-2 border rounded mt-1" /></div>
                        <div className="flex gap-2">
                            <div className="flex-1"><label className="text-xs text-gray-500 font-bold">색상</label><input type="color" value={wmColor} onChange={e => setWmColor(e.target.value)} className="w-full h-10 cursor-pointer mt-1" /></div>
                            <div className="flex-1"><label className="text-xs text-gray-500 font-bold">투명도</label><input type="range" min="0.1" max="1" step="0.1" value={wmOpacity} onChange={e => setWmOpacity(parseFloat(e.target.value))} className="w-full mt-2" /></div>
                        </div>
                        <div><label className="text-xs text-gray-500 font-bold">크기 ({wmSize}px)</label><input type="range" min="10" max="100" value={wmSize} onChange={e => setWmSize(parseInt(e.target.value))} className="w-full mt-2" /></div>
                      </div>
                      
                      <div className="w-full md:w-2/3 relative border-2 border-blue-200 overflow-hidden bg-gray-100 select-none rounded-lg">
                        <img ref={previewImgRef} src={previewUrl} alt="Preview" className="w-full h-auto pointer-events-none block" />
                        <Draggable nodeRef={draggableRef} bounds="parent" onStop={handleDragStop} defaultPosition={{x: 0, y: 0}}>
                          <div 
                            ref={draggableRef}
                            className="absolute top-0 left-0 cursor-move font-bold whitespace-nowrap p-2 border-2 border-transparent hover:border-dashed hover:border-white/50"
                            style={{ color: wmColor, fontSize: `${wmSize}px`, opacity: wmOpacity, textShadow: '2px 2px 4px rgba(0,0,0,0.5)', zIndex: 20 }}>
                            {wmText}
                          </div>
                        </Draggable>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button type="submit" disabled={isUploading || files.length === 0} className={`w-full py-4 rounded-lg text-white font-bold text-lg shadow-md ${(isUploading || files.length === 0) ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isUploading ? '업로드 및 처리 중... ⏳' : '업로드 시작 🚀'}
              </button>
            </form>
          </div>
        )}

        {/* ==================== 2. 관리/삭제 탭 ==================== */}
        {adminTab === 'manage' && (
          <div className="animate-fade-in">
            {selectedAlbum ? (
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <button onClick={() => setSelectedAlbum(null)} className="text-gray-500 hover:text-black font-bold flex items-center">
                    ← 앨범 목록으로
                  </button>
                  <h2 className="text-lg font-bold">{selectedAlbum.title} (총 {selectedAlbum.photos.length}장)</h2>
                </div>
                {selectedAlbum.photos.length === 0 ? (
                  <p className="text-center py-10 text-gray-400">사진이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {selectedAlbum.photos.map((url, idx) => (
                      <div key={idx} className="relative aspect-square group rounded-lg overflow-hidden border border-gray-200">
                        <img src={url} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button 
                             onClick={() => handleDeletePhoto(selectedAlbum.id, url, selectedAlbum.photos)}
                             className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg text-sm font-bold"
                           >
                             🗑️ 삭제
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">앨범을 완전히 삭제하거나, 개별 사진을 지울 수 있습니다.</p>
                {albumsList.length === 0 ? (
                  <p className="text-center py-10 text-gray-400">등록된 앨범이 없습니다.</p>
                ) : (
                  albumsList.map((album) => (
                    <div key={album.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:shadow-md transition gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                          {album.photos && album.photos[0] ? (
                            <img src={album.photos[0]} alt="thumbnail" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Empty</div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 flex items-center">
                            {album.isSecret && <span className="mr-1">🔒</span>}
                            {album.title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(album.createdAt?.seconds * 1000).toLocaleDateString()} · 사진 {album.photos?.length || 0}장
                            {album.password && <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded font-bold text-gray-700">비번: {album.password}</span>}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <button 
                          onClick={() => handleCopyLink(album)}
                          className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 text-sm font-bold rounded hover:bg-green-200 transition-colors"
                        >
                          {album.isSecret ? '🔗 링크/비번 복사' : '🔗 링크 복사'}
                        </button>
                        <button 
                          onClick={() => setSelectedAlbum(album)}
                          className="px-3 py-1 bg-white border border-gray-300 text-sm font-bold rounded hover:bg-gray-100 transition-colors"
                        >
                          사진 관리
                        </button>
                        <button 
                          onClick={() => handleDeleteAlbum(album.id, album.photos)}
                          className="px-3 py-1 bg-red-100 text-red-600 border border-red-200 text-sm font-bold rounded hover:bg-red-200 transition-colors"
                        >
                          앨범 삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== 3. 앱 설정 탭 ==================== */}
        {adminTab === 'settings' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
              <h2 className="text-lg font-bold text-purple-900 mb-2">✨ 메인 화면 문구 변경</h2>
              <p className="text-sm text-purple-700 mb-4">
                사용자가 앱에 접속했을 때 PicJuno 로고 아래에 보이는 소개 문구를 변경합니다.<br/>
                예: "Picturewrite by Juno.", "2026학년도 3반 사진첩" 등
              </p>
              
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <input 
                  type="text" 
                  value={siteSubtitle} 
                  onChange={(e) => setSiteSubtitle(e.target.value)} 
                  placeholder="표시할 문구를 입력하세요" 
                  className="w-full p-4 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  required
                />
                <button 
                  type="submit" 
                  disabled={isSavingSettings}
                  className={`w-full py-4 rounded-lg text-white font-bold shadow-md transition-all
                    ${isSavingSettings ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700 hover:shadow-lg'}`}
                >
                  {isSavingSettings ? '저장 중...' : '설정 저장하기 💾'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}