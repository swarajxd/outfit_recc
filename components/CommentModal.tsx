import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';

interface Comment {
  id: string;
  post_id: string;
  user_clerk_id: string;
  content: string;
  created_at: string;
  user?: {
    username?: string;
    full_name?: string;
    profile_image_url?: string;
  };
}

interface CommentModalProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
  serverBase: string;
}

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80';

export default function CommentModal({
  visible,
  postId,
  onClose,
  serverBase,
}: CommentModalProps) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const authHeader = `Bearer dev:${user?.id}`;
      
      const response = await fetch(`${serverBase}/api/comments/${postId}`, {
        headers: {
          Authorization: authHeader,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch comments');

      const data = await response.json();
      setComments(data.comments || []);
      setCommentCount(data.comments?.length || 0);
    } catch (err) {
      console.error('Fetch comments error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId, serverBase, user?.id]);

  // Fetch comments when modal opens
  useEffect(() => {
    if (visible) {
      fetchComments();
    }
  }, [visible, postId, fetchComments]);

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Empty comment', 'Please write something before posting');
      return;
    }

    try {
      setSubmitting(true);
      if (!user?.id) throw new Error('Not authenticated');

      const authHeader = `Bearer dev:${user?.id}`;

      const response = await fetch(`${serverBase}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          post_id: postId,
          content: newComment,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add comment');
      }

      const data = await response.json();
      setComments([data.comment, ...comments]);
      setCommentCount(commentCount + 1);
      setNewComment('');
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete comment', 'Are you sure?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            if (!user?.id) throw new Error('Not authenticated');

            const authHeader = `Bearer dev:${user?.id}`;

            const response = await fetch(
              `${serverBase}/api/comments/${commentId}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: authHeader,
                },
              },
            );

            if (!response.ok) throw new Error('Failed to delete comment');

            setComments(comments.filter((c) => c.id !== commentId));
            setCommentCount(Math.max(0, commentCount - 1));
          } catch (err) {
            Alert.alert('Error', String(err));
          }
        },
      },
    ]);
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isOwnComment = item.user_clerk_id === user?.id;
    const timeAgo = formatTimeAgo(new Date(item.created_at));

    return (
      <View style={styles.commentContainer}>
        <Image
          source={{
            uri: item.user?.profile_image_url || DEFAULT_AVATAR,
          }}
          style={styles.avatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.username}>
              {item.user?.username || item.user?.full_name || 'Unknown'}
            </Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
          <Text style={styles.commentText}>{item.content}</Text>
        </View>
        {isOwnComment && (
          <TouchableOpacity
            onPress={() => handleDeleteComment(item.id)}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash" size={16} color="#ff4757" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments ({commentCount})</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Comments List */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.contentContainer}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No comments yet. Be the first to comment!
              </Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderComment}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => (
                <View style={styles.separator} />
              )}
            />
          )}

          {/* Comment Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
              editable={!submitting}
            />
            <TouchableOpacity
              onPress={handleAddComment}
              disabled={submitting || !newComment.trim()}
              style={[
                styles.sendBtn,
                (submitting || !newComment.trim()) && styles.sendBtnDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeBtn: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
  commentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#333',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  timeAgo: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  commentText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff4757',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,71,87,0.5)',
  },
});
