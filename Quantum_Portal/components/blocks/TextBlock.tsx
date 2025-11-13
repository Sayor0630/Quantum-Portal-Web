'use client';

import { Box, Button, Group, Menu, Modal, Select, Stack, Text } from '@mantine/core';
import { RichTextEditor, getTaskListExtension } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import TaskItem from '@tiptap/extension-task-item';
import TipTapTaskList from '@tiptap/extension-task-list';
import { useEffect, useState } from 'react';
import { DataSourceType } from './types';
import { getDataSourceFieldOptions } from './utils';
import { IconBrackets } from '@tabler/icons-react';

interface TextBlockProps {
  content: any;
  canvasTextColor?: string;
  editMode?: 'edit' | 'preview' | null;
  onUpdateContent?: (updates: any) => void;
}

export function TextBlock({ 
  content, 
  canvasTextColor = '#000000',
  editMode = null,
  onUpdateContent,
}: TextBlockProps) {
  const [isSourceCodeModeActive, setIsSourceCodeModeActive] = useState(false);
  const [isBindingModalOpen, setIsBindingModalOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceType>(DataSourceType.PRODUCT);
  const [selectedField, setSelectedField] = useState<string>('');
  
  // Check if data binding is enabled
  const isDataBindingEnabled = content?.dataBinding?.sourceType !== DataSourceType.STATIC;

  // Rich text editor for text blocks
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink,
      Underline,
      TextStyle,
      Color,
      getTaskListExtension ? getTaskListExtension(TipTapTaskList) : TipTapTaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      Placeholder.configure({
        placeholder: isDataBindingEnabled 
          ? 'Type text and use the {{}} button to insert dynamic data...' 
          : 'Click to start typing...',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Subscript,
      Superscript,
    ],
    immediatelyRender: false, // Prevent SSR hydration mismatch
    shouldRerenderOnTransaction: true,
    content: content.text || '',
    editable: editMode === 'edit', // Always editable in edit mode (removed binding check)
    onUpdate: ({ editor }) => {
      if (onUpdateContent) {
        onUpdateContent({ text: editor.getHTML() });
      }
    },
  });

  // Update editor content when block content changes
  useEffect(() => {
    if (editor && content.text !== editor.getHTML()) {
      editor.commands.setContent(content.text || '');
    }
  }, [content.text, editor]);

  // Update editor editable state when editMode changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editMode === 'edit'); // Always editable in edit mode
    }
  }, [editMode, editor]);

  // Function to insert binding at cursor position
  const insertBinding = () => {
    if (!editor || !selectedField) return;
    
    const binding = `{{${selectedField}}}`;
    editor.chain().focus().insertContent(binding).run();
    
    // Close modal and reset
    setIsBindingModalOpen(false);
    setSelectedField('');
  };

  if (!editor) return null;
  
  return (
    <Box style={{ width: content.width || '100%', margin: '0 auto' }}>
      {editMode === 'edit' ? (
        <>
          {/* Binding Insert Modal */}
          <Modal
            opened={isBindingModalOpen}
            onClose={() => setIsBindingModalOpen(false)}
            title="Insert Dynamic Data"
            size="md"
          >
            <Stack gap="md">
              <Select
                label="Data Source"
                value={selectedDataSource}
                onChange={(value) => {
                  setSelectedDataSource(value as DataSourceType);
                  setSelectedField(''); // Reset field when source changes
                }}
                data={[
                  { value: DataSourceType.PRODUCT, label: 'Product' },
                  { value: DataSourceType.CATEGORY, label: 'Category' },
                  { value: DataSourceType.COLLECTION, label: 'Collection' },
                  { value: DataSourceType.CUSTOMER, label: 'Customer' },
                ]}
              />
              
              <Select
                label="Field"
                value={selectedField}
                onChange={(value) => setSelectedField(value || '')}
                data={getDataSourceFieldOptions(selectedDataSource, 'text').map(opt => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                placeholder="Select a field to insert..."
                searchable
              />
              
              {selectedField && (
                <Text size="sm" c="dimmed">
                  Will insert: <Text span fw={600} ff="monospace">{'{{' + selectedField + '}}'}</Text>
                </Text>
              )}
              
              <Group justify="flex-end" gap="xs">
                <Button 
                  variant="subtle" 
                  onClick={() => setIsBindingModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={insertBinding}
                  disabled={!selectedField}
                >
                  Insert Binding
                </Button>
              </Group>
            </Stack>
          </Modal>
          
          <RichTextEditor editor={editor} onSourceCodeTextSwitch={setIsSourceCodeModeActive}>
            <RichTextEditor.Toolbar>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.SourceCode />
              </RichTextEditor.ControlsGroup>

              {!isSourceCodeModeActive && (
                <>
                  {/* Insert Binding Button - Only show in binding mode */}
                  {isDataBindingEnabled && (
                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.Control
                        onClick={() => setIsBindingModalOpen(true)}
                        aria-label="Insert dynamic data binding"
                        title="Insert dynamic data ({{}})"
                      >
                        <IconBrackets stroke={1.5} size="1rem" />
                      </RichTextEditor.Control>
                    </RichTextEditor.ControlsGroup>
                  )}

                  <RichTextEditor.ColorPicker
                    colors={[
                      '#25262b',
                      '#868e96',
                      '#fa5252',
                      '#e64980',
                      '#be4bdb',
                      '#7950f2',
                      '#4c6ef5',
                      '#228be6',
                      '#15aabf',
                      '#12b886',
                      '#40c057',
                      '#82c91e',
                      '#fab005',
                      '#fd7e14',
                    ]}
                  />

                  <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Bold />
                    <RichTextEditor.Italic />
                    <RichTextEditor.Underline />
                    <RichTextEditor.Strikethrough />
                    <RichTextEditor.Highlight />
                    <RichTextEditor.ClearFormatting />
                    <RichTextEditor.Code />
                    <RichTextEditor.CodeBlock />
                  </RichTextEditor.ControlsGroup>

                  <RichTextEditor.ControlsGroup>
                    <RichTextEditor.H1 />
                    <RichTextEditor.H2 />
                    <RichTextEditor.H3 />
                    <RichTextEditor.H4 />
                    <RichTextEditor.H5 />
                    <RichTextEditor.H6 />
                  </RichTextEditor.ControlsGroup>

                  <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Blockquote />
                    <RichTextEditor.Hr />
                    <RichTextEditor.BulletList />
                    <RichTextEditor.OrderedList />
                    <RichTextEditor.TaskList />
                    <RichTextEditor.TaskListLift />
                    <RichTextEditor.TaskListSink />
                    <RichTextEditor.Subscript />
                    <RichTextEditor.Superscript />
                  </RichTextEditor.ControlsGroup>

                  <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Link />
                    <RichTextEditor.Unlink />
                  </RichTextEditor.ControlsGroup>

                  <RichTextEditor.ControlsGroup>
                    <RichTextEditor.AlignLeft />
                    <RichTextEditor.AlignCenter />
                    <RichTextEditor.AlignJustify />
                    <RichTextEditor.AlignRight />
                  </RichTextEditor.ControlsGroup>

                  <RichTextEditor.ControlsGroup>
                    <RichTextEditor.Undo />
                    <RichTextEditor.Redo />
                  </RichTextEditor.ControlsGroup>
                </>
              )}
            </RichTextEditor.Toolbar>

            <RichTextEditor.Content
              style={{
                fontSize: content.fontSize || '16px',
                color: content.color === 'inherit' || !content.color ? canvasTextColor : content.color,
                fontWeight: content.fontWeight || 'normal',
              }}
            />
          </RichTextEditor>
        </>
      ) : (
        <div
          style={{
            fontSize: content.fontSize || '16px',
            color: content.color === 'inherit' || !content.color ? canvasTextColor : content.color,
            fontWeight: content.fontWeight || 'normal',
          }}
          dangerouslySetInnerHTML={{ __html: content.text || '' }}
        />
      )}
    </Box>
  );
}
