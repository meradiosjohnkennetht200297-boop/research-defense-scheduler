import Link from 'next/link'
import { saveResearchGroupEdits } from './actions'

type FacultyRow = { id: string; full_name: string; is_active: boolean; can_advise: boolean; can_teach_research: boolean }
type GroupData = { id: string; title: string; program: string | null; major: string | null; defense_type: string | null; contact_person: string; contact_email: string | null; contact_number: string | null; research_file_url: string | null; instructor_id: string | null; adviser_id: string | null }

export default function EditResearchForm({ group, faculty, memberNames }: { group: GroupData; faculty: FacultyRow[]; memberNames: string[] }) {
  const instructors = faculty.filter((person) => (person.is_active && person.can_teach_research) || person.id === group.instructor_id)
  const advisers = faculty.filter((person) => (person.is_active && person.can_advise) || person.id === group.adviser_id)
  return (
    <form action={saveResearchGroupEdits} className="card schedule-form workspace-refined-form">
      <input name="groupId" type="hidden" value={group.id} />
      <section className="workspace-form-section">
        <div className="workspace-section-heading"><span className="workspace-section-number">1</span><div><h3>Research information</h3><p>Correct the title, program, major, and defense type.</p></div></div>
        <div className="field-grid workspace-schedule-fields">
          <div className="field full"><label htmlFor="title">Research title <span className="required-mark">*</span></label><textarea defaultValue={group.title} id="title" maxLength={500} name="title" required rows={3} /></div>
          <div className="field"><label htmlFor="program">Program <span className="required-mark">*</span></label><select defaultValue={group.program ?? ''} id="program" name="program" required><option value="">Select program</option><option value="BEED">BEED</option><option value="BSED">BSED</option><option value="BSA">BSA</option><option value="BSAIS">BSAIS</option><option value="BSBA">BSBA</option></select></div>
          <div className="field"><label htmlFor="major">Major</label><select defaultValue={group.major ?? ''} id="major" name="major"><option value="">Not applicable</option><optgroup label="BSED"><option value="English">English</option><option value="Filipino">Filipino</option><option value="Mathematics">Mathematics</option><option value="Science">Science</option></optgroup><optgroup label="BSBA"><option value="MM">MM</option><option value="FM">FM</option><option value="HRM">HRM</option></optgroup></select><p className="field-help">Required only for BSED and BSBA.</p></div>
          <div className="field"><label htmlFor="defenseType">Defense type <span className="required-mark">*</span></label><select defaultValue={group.defense_type ?? ''} id="defenseType" name="defenseType" required><option value="">Select defense type</option><option value="title">Title Defense</option><option value="proposal">Proposal Defense</option><option value="final">Final Defense</option></select></div>
        </div>
      </section>
      <section className="workspace-form-section">
        <div className="workspace-section-heading"><span className="workspace-section-number">2</span><div><h3>Group and faculty</h3><p>Edit group members and assigned research faculty.</p></div></div>
        <div className="field"><label htmlFor="members">Group members <span className="required-mark">*</span></label><textarea defaultValue={memberNames.join('\n')} id="members" name="members" required rows={Math.min(10, Math.max(5, memberNames.length + 1))} /><p className="field-help">Enter one member per line. Maximum of 20 members.</p></div>
        <div className="field-grid" style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="instructorId">Research instructor</label><select defaultValue={group.instructor_id ?? ''} id="instructorId" name="instructorId"><option value="">Not assigned</option>{instructors.map((person) => <option key={person.id} value={person.id}>{person.full_name}{person.is_active ? '' : ' (inactive)'}</option>)}</select></div>
          <div className="field"><label htmlFor="adviserId">Research adviser</label><select defaultValue={group.adviser_id ?? ''} id="adviserId" name="adviserId"><option value="">Not assigned</option>{advisers.map((person) => <option key={person.id} value={person.id}>{person.full_name}{person.is_active ? '' : ' (inactive)'}</option>)}</select></div>
        </div>
      </section>
      <section className="workspace-form-section">
        <div className="workspace-section-heading"><span className="workspace-section-number">3</span><div><h3>Contact and research file</h3><p>Correct the administrative contact details and private research-file link.</p></div></div>
        <div className="field-grid">
          <div className="field"><label htmlFor="contactPerson">Contact person <span className="required-mark">*</span></label><input defaultValue={group.contact_person} id="contactPerson" maxLength={200} name="contactPerson" required /></div>
          <div className="field"><label htmlFor="contactEmail">Email</label><input defaultValue={group.contact_email ?? ''} id="contactEmail" maxLength={320} name="contactEmail" type="email" /></div>
          <div className="field"><label htmlFor="contactNumber">Contact number</label><input defaultValue={group.contact_number ?? ''} id="contactNumber" maxLength={80} name="contactNumber" /></div>
          <div className="field full"><label htmlFor="researchFileUrl">Google Drive research file</label><input defaultValue={group.research_file_url ?? ''} id="researchFileUrl" maxLength={2000} name="researchFileUrl" placeholder="https://drive.google.com/..." type="url" /><p className="field-help">This link remains private from the public schedule.</p></div>
        </div>
      </section>
      <div className="workspace-form-actions"><div className="workspace-save-note"><strong>Submission information only</strong><span>Saving here does not change the research status, defense schedule, panel, or completion history.</span></div><div className="workspace-action-buttons"><Link className="button button-secondary" href={`/admin/groups/${group.id}`}>Cancel</Link><button className="button workspace-save-button" type="submit">Save Changes</button></div></div>
    </form>
  )
}
